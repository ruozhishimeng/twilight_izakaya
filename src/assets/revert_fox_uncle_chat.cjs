const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'character/fox_uncle/nodes_chat.yaml');
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  ['id: chat_encouragement', 'id: chat_01'],
  ['id: chat_farewell', 'id: chat_02'],
  ['id: chat_history', 'id: chat_03'],
  ['id: chat_history_deep', 'id: chat_003_deep'],
  ['id: chat_philosophy', 'id: chat_04'],
  ['id: chat_sunset', 'id: chat_05'],
  ['id: chat_sunset_deep', 'id: chat_005_deep'],
  ['id: chat_rain', 'id: chat_weather_rain'],
  ['id: chat_temperature', 'id: chat_weather_temperature'],
];

for (const [oldId, newId] of replacements) {
  content = content.replace(oldId, newId);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Reverted fox_uncle/nodes_chat.yaml');
