const fs = require('fs');
const path = require('path');

const chars = [
  'tired_salaryman',
  'young_couple',
  'homesick_grandma',
  'retired_grandpa',
  'insomniac_writer'
];

for (const char of chars) {
  const file = path.join(__dirname, 'character', char, 'nodes_main.yaml');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace('id: main_arrival', 'id: arrival');
  content = content.replace('id: main_drink_classic', 'id: drink_classic');
  content = content.replace('id: main_drink_vodka', 'id: drink_vodka');
  content = content.replace('id: main_drink_result', 'id: drink_result');
  fs.writeFileSync(file, content, 'utf8');
  console.log('Reverted ' + char);
}
