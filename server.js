const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3033;

app.use(express.static('public'));
app.use(express.json());

// No server.js, atualize a rota principal:
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/init', (req, res) => {
  res.json({
    cwd: process.cwd(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version
  });
});

// API para listar arquivos - agora aceita um path específico
app.get('/api/files', (req, res) => {
  try {
    const targetPath = req.query.path || process.cwd();
    const excludeDirs = ['node_modules', '.git', '.vscode', '.idea'];
    const files = listFiles(targetPath, excludeDirs);
    res.json({ 
      files, 
      currentPath: targetPath,
      root: process.cwd()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API para navegar para pasta pai
app.get('/api/parent', (req, res) => {
  try {
    const currentPath = req.query.path || process.cwd();
    const parentPath = path.dirname(currentPath);
    
    // Verificar se podemos sair do diretório raiz do sistema
    if (parentPath === currentPath || parentPath === '') {
      return res.json({ 
        files: [], 
        currentPath: currentPath,
        isRoot: true 
      });
    }
    
    const excludeDirs = ['node_modules', '.git', '.vscode', '.idea'];
    const files = listFiles(parentPath, excludeDirs);
    
    res.json({ 
      files, 
      currentPath: parentPath,
      isRoot: false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API para ler arquivo
app.get('/api/file', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Caminho necessário' });
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content, path: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API para salvar arquivo
app.post('/api/file', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    
    if (!filePath) return res.status(400).json({ error: 'Caminho necessário' });
    
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API para escolher pasta (input file)
app.post('/api/select-folder', (req, res) => {
  try {
    const { folderPath } = req.body;
    
    if (!folderPath) {
      return res.status(400).json({ error: 'Pasta não especificada' });
    }
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }
    
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Caminho não é uma pasta' });
    }
    
    const excludeDirs = ['node_modules', '.git', '.vscode', '.idea'];
    const files = listFiles(folderPath, excludeDirs);
    
    res.json({ 
      success: true, 
      files, 
      currentPath: folderPath 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Função para listar arquivos
function listFiles(dir, excludeDirs = [], depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return [];
  
  const files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      
      try {
        const stat = fs.statSync(fullPath);
        
        // Pular diretórios excluídos
        if (stat.isDirectory() && excludeDirs.includes(item)) {
          continue;
        }
        
        const fileObj = {
          name: item,
          path: fullPath,
          type: stat.isDirectory() ? 'directory' : 'file',
          extension: stat.isDirectory() ? '' : path.extname(item).toLowerCase(),
          size: stat.size,
          modified: stat.mtime
        };
        
        if (stat.isDirectory()) {
          // Limitar profundidade para performance
          if (depth < 2) {
            fileObj.children = listFiles(fullPath, excludeDirs, depth + 1, maxDepth);
          } else {
            fileObj.hasChildren = true; // Indicar que há mais arquivos
          }
        }
        
        files.push(fileObj);
      } catch (err) {
        console.warn(`Ignorando ${fullPath}: ${err.message}`);
      }
    }
    
    // Ordenar: pastas primeiro, depois arquivos
    files.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    console.warn(`Não foi possível ler diretório ${dir}: ${err.message}`);
  }
  
  return files;
}

app.listen(PORT, () => {
  console.log(`🚀 IDE com Navegação rodando em: http://localhost:${PORT}`);
  console.log(`📁 Diretório inicial: ${process.cwd()}`);
});