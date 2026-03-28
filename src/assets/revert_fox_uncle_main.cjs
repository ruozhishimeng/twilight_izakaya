const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'character/fox_uncle/nodes_main.yaml');
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  ['id: main_arrival_week1', 'id: visit_01_arrival'],
  ['id: main_response_service', 'id: 001_response_service'],
  ['id: main_response_curious', 'id: 001_response_curious'],
  ['id: main_response_humble', 'id: 001_response_humble'],
  ['id: main_response_converge', 'id: 001_response_converge'],
  ['id: main_round2', 'id: 001_round2'],
  ['id: main_arrival_week1_day3', 'id: visit_02_arrival'],
  ['id: main_response_sweet', 'id: 002_response_sweet'],
  ['id: main_response_recall', 'id: 002_response_recall'],
  ['id: main_response_humble_02', 'id: 002_response_humble'],
  ['id: main_response_converge_02', 'id: 002_response_converge'],
  ['id: main_round2_02', 'id: 002_round2'],
  ['id: main_arrival_week2_day1', 'id: visit_03_arrival'],
  ['id: main_response_important', 'id: 003_response_important'],
  ['id: main_response_ready', 'id: 003_response_ready'],
  ['id: main_response_humble_03', 'id: 003_response_humble'],
  ['id: main_round2_03', 'id: 003_round2'],
  ['id: main_arrival_week2_day3', 'id: visit_04_arrival'],
  ['id: main_response_recall_04', 'id: 004_response_recall'],
  ['id: main_response_test', 'id: 004_response_test'],
  ['id: main_response_forgot', 'id: 004_response_forgot'],
  ['id: main_round2_04', 'id: 004_round2'],
  ['id: main_arrival_week3_day1', 'id: visit_05_arrival'],
  ['id: main_response_beautiful', 'id: 005_response_beautiful'],
  ['id: main_response_ready_05', 'id: 005_response_ready'],
  ['id: main_response_humble_05', 'id: 005_response_humble'],
  ['id: main_round2_05', 'id: 005_round2'],
  ['id: main_arrival_week3_day3', 'id: visit_06_arrival'],
  ['id: main_response_greeting', 'id: 006_response_greeting'],
  ['id: main_arrival_week4_day1', 'id: visit_07_arrival'],
  ['id: main_response_recall_all', 'id: 007_response_recall_all'],
  ['id: main_response_practice', 'id: 007_response_practice'],
  ['id: main_response_teach', 'id: 007_response_teach'],
  ['id: main_round2_07', 'id: 007_round2'],
];

for (const [oldId, newId] of replacements) {
  content = content.replace(oldId, newId);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Reverted fox_uncle/nodes_main.yaml');
