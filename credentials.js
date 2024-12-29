const fs = require('fs');
const path = require('path');

// Carregar credenciais de um arquivo JSON
const getCredentials = () => {
  const filePath = path.join(__dirname, 'logins', 'users.json');
  if (!fs.existsSync(filePath)) {
    throw new Error('Arquivo de credenciais não encontrado.');
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
};

module.exports = { getCredentials };
