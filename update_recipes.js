import fs from 'fs';
const file = 'src/assets/recipes/recipes.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const keepMixers = ['m01', 'm07', 'm09', 'm10', 'm12'];
data.ingredients.mixers.forEach(m => {
  m.unlocked = keepMixers.includes(m.id);
});

const keepFlavors = ['f01', 'f02', 'f06', 'f08', 'f15'];
data.ingredients.flavors.forEach(f => {
  f.unlocked = keepFlavors.includes(f.id);
});

fs.writeFileSync(file, JSON.stringify(data, null, 2));
