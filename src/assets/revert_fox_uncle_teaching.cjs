const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'character/fox_uncle/nodes_teaching_reward_challenge_ending.yaml');
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  ['id: teaching_sake', 'id: teaching_01'],
  ['id: teaching_sake_mixing', 'id: teaching_01_mixing'],
  ['id: teaching_amazake', 'id: teaching_02'],
  ['id: teaching_amazake_mixing', 'id: teaching_02_mixing'],
  ['id: teaching_yuzu', 'id: teaching_03'],
  ['id: teaching_yuzu_mixing', 'id: teaching_03_mixing'],
  ['id: teaching_review', 'id: teaching_review'], // Wait, what was it?
  ['id: teaching_review_mixing', 'id: teaching_review_mixing'],
  ['id: teaching_yuzu_tea', 'id: teaching_04'],
  ['id: teaching_yuzu_tea_mixing', 'id: teaching_04_mixing'],
  ['id: teaching_review_02', 'id: teaching_review_02'],
  ['id: teaching_review_02_mixing', 'id: teaching_review_02_mixing'],
  ['id: teaching_free_practice', 'id: teaching_free_practice'],
  ['id: teaching_free_practice_mixing', 'id: teaching_free_practice_mixing'],
  ['id: reward_sake', 'id: reward_01'],
  ['id: reward_sake_describe', 'id: reward_01_describe'],
  ['id: reward_sake_end', 'id: reward_01_end'],
  ['id: reward_amazake', 'id: reward_02'],
  ['id: reward_amazake_advice', 'id: reward_02_advice'],
  ['id: reward_amazake_end', 'id: reward_02_end'],
  ['id: reward_yuzu', 'id: reward_03'],
  ['id: reward_yuzu_describe', 'id: reward_03_describe'],
  ['id: reward_yuzu_end', 'id: reward_03_end'],
  ['id: reward_review', 'id: reward_review'],
  ['id: reward_review_end', 'id: reward_review_end'],
  ['id: reward_yuzu_tea', 'id: reward_04'],
  ['id: reward_yuzu_tea_poetic', 'id: reward_04_poetic'],
  ['id: reward_yuzu_tea_end', 'id: reward_04_end'],
  ['id: reward_review_02', 'id: reward_review_02'],
  ['id: reward_review_02_end', 'id: reward_review_02_end'],
  ['id: reward_free_practice', 'id: reward_05'],
  ['id: reward_free_practice_end', 'id: reward_05_end'],
  ['id: challenge_final', 'id: challenge_01'],
  ['id: challenge_final_mixing', 'id: challenge_01_mixing'],
  ['id: ending_success', 'id: ending_01_success'],
  ['id: ending_fail', 'id: ending_01_fail'],
];

for (const [oldId, newId] of replacements) {
  content = content.replace(oldId, newId);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Reverted fox_uncle/nodes_teaching_reward_challenge_ending.yaml');
