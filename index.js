// Importações necessárias
const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');

const server = express();
const links = require('./src/data/linksdownload.json');
const porta = 8080;



// Variáveis globais
let requestCounter = 0; // Contador global de requisições para a rota /v1/mp/all
let apiOnline = true; // Controle de status da API
const requestHistoryFile = path.join(__dirname, 'requestHistory.json'); // Caminho do arquivo JSON para histórico

// Função para salvar o histórico em um arquivo JSON
function saveRequestHistory(count) {
  let history = [];

  // Tenta ler o arquivo existente
  if (fs.existsSync(requestHistoryFile)) {
    history = JSON.parse(fs.readFileSync(requestHistoryFile, 'utf8'));
  }

  // Adiciona um novo registro com a data atual e a contagem de requisições
  history.push({
    date: new Date().toISOString(),
    requestCount: count,
  });

  // Escreve o histórico de volta no arquivo
  fs.writeFileSync(requestHistoryFile, JSON.stringify(history, null, 2), 'utf8');
}

// Configuração para zerar o contador a cada 24 horas
setInterval(() => {
  saveRequestHistory(requestCounter); // Salva o contador atual no histórico
  requestCounter = 0; // Zera o contador
  console.log('Contador de requisições zerado e salvo no histórico.');
}, 24 * 60 * 60 * 1000); // Intervalo de 24 horas

const { getCredentials } = require('./credentials');

// Middleware para autenticação
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Credenciais não fornecidas' });
  }

  const [type, credentials] = authHeader.split(' ');
  if (type !== 'Basic' || !credentials) {
    return res.status(401).json({ error: 'Formato de autenticação inválido' });
  }

  const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
  const user = getCredentials().find(u => u.username === username && u.password === password);

  if (user) {
    return next();
  }

  return res.status(403).json({ error: 'Credenciais inválidas' });
}

const bodyParser = require('body-parser'); // Middleware para lidar com dados JSON
server.use(bodyParser.json());

// Rota para adicionar dados ao JSON
server.post('/add-data', (req, res) => {
  const newData = req.body;

  // Validação simples para verificar se os campos necessários estão presentes
  if (!newData.id || !newData.name || !newData.link || !newData.preview || !newData.url || !newData.urlPreview) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  const filePath = path.join(__dirname, 'src/data/linksdownload.json');

  try {
    // Ler o JSON existente
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Verificar se o ID já existe
    if (data.find(item => item.id === newData.id)) {
      return res.status(400).json({ error: 'ID já existe.' });
    }

    // Adicionar o novo dado
    data.push(newData);

    // Salvar o JSON atualizado
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    res.json({ message: 'Dados adicionados com sucesso!', data: newData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar os dados.' });
  }
});

// Servindo arquivos estáticos da pasta "media/amostras"
server.use('/media/amostras', express.static(path.join(__dirname, 'media/amostras')));

// Servindo o frontend
server.use(express.static(path.join(__dirname, 'public')));

// Rota para alternar o estado da API (ativar/desativar)
server.post('/toggle-api', authenticate, (req, res) => {
  apiOnline = !apiOnline;
  res.json({ apiOnline });
});

// Rota para obter o status da API
server.get('/status', (req, res) => {
  return res.json({ status: apiOnline ? 'online' : 'offline' });
});

server.get('/add-data', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add-data.html'));
});

// Rota para autenticação sem alterar o estado da API
server.post('/authenticate', authenticate, (req, res) => {
  res.json({ message: 'Autenticação bem-sucedida!' });
});

// Rota para retornar o número atual de requisições
server.get('/request-count', (req, res) => {
  return res.json({ requests_count: requestCounter });
});

// Rota para a funcionalidade principal de /v1/mp/all
server.get('/v1/mp/all', (req, res) => {
  if (!apiOnline) {
    return res.status(503).json({ error: 'API está offline' });
  }
  requestCounter++; // Incrementa o contador para cada requisição nesta rota
  return res.json(links);
});

// Rota para contar arquivos .zip
server.get('/count-zip-files', (req, res) => {
  if (!apiOnline) {
    return res.status(503).json({ error: 'API está offline' });
  }
  const directoryPath = path.join(__dirname, 'media/amostras');
  let zipCount = 0;

  fs.readdirSync(directoryPath).forEach(file => {
    if (file.endsWith('.zip')) {
      zipCount++;
    }
  });

  res.json({ zipCount });
});

// Rota para obter IPs do usuário e do servidor
server.get('/get-ips', (req, res) => {
  const interfaces = os.networkInterfaces();
  let userIp = req.ip || req.connection.remoteAddress;

  let serverIp = '';
  for (let iface in interfaces) {
    interfaces[iface].forEach(details => {
      if (details.family === 'IPv4' && !details.internal) {
        serverIp = details.address;
      }
    });
  }

  res.json({ serverIp, userIp });
});

// Rota principal para a página inicial
server.get('/', (req, res) => {
  requestCounter = 0; // Zera o contador ao carregar a página inicial
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para a página de login
server.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Servindo o arquivo JSON de links
server.get('/src/data/linksdownload.json', (req, res) => {
  const filePath = path.join(__dirname, 'src/data/linksdownload.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao ler o arquivo JSON.' });
    }
    return res.json(JSON.parse(data));
  });
});

// Rota para editar um item no JSON
server.put('/edit-data', (req, res) => {
  const updatedData = req.body;

  // Verifica se o ID está presente
  if (!updatedData.id || !updatedData.name || !updatedData.link || !updatedData.preview || !updatedData.url || !updatedData.urlPreview) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  const filePath = path.join(__dirname, 'src/data/linksdownload.json');

  try {
    // Ler o JSON existente
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Encontra o item a ser editado
    const itemIndex = data.findIndex(item => item.id === updatedData.id);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'ID não encontrado.' });
    }

    // Atualiza o item com os novos dados
    data[itemIndex] = updatedData;

    // Salva o JSON atualizado
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    res.json({ message: 'Item editado com sucesso!', data: updatedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar o item.' });
  }
});
// Rota para deletar um item do JSON
server.delete('/delete-data', (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID é obrigatório para deletar o item.' });
  }

  const filePath = path.join(__dirname, 'src/data/linksdownload.json');

  try {
    // Ler o JSON existente
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Encontra o item a ser deletado
    const itemIndex = data.findIndex(item => item.id === id);
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'ID não encontrado.' });
    }

    // Remove o item da lista
    data.splice(itemIndex, 1);

    // Salva o JSON atualizado
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    res.json({ message: 'Item deletado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao deletar o item.' });
  }
});


// Inicializa o servidor na porta definida
server.listen(porta, () => {
  console.log(`Servidor está online na porta ${porta}...`);
});
