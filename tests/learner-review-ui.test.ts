import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const view = readFileSync(new URL('../components/learner-management-view.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('les résultats restent synthétiques tant que la correction n’est pas ouverte', () => {
  assert.match(view, /<details className="learner-review-card"/);
  assert.match(view, /<summary>/);
  assert.match(view, /Résultat/);
  assert.match(view, /Noter et commenter/);
});

test('la correction présente des champs explicites et sépare le commentaire public de la note interne', () => {
  assert.match(view, />Décision<select/);
  assert.match(view, />Note<input/);
  assert.match(view, />Barème<input/);
  assert.match(view, /Commentaire pour l’apprenant/);
  assert.match(view, /invisible pour l’apprenant/);
});

test('les statuts techniques sont traduits et la mise en page reste adaptée aux petits écrans', () => {
  assert.match(view, /in_progress:'En cours'/);
  assert.match(view, /completed:'Terminée'/);
  assert.match(view, /retry:'À refaire'/);
  assert.match(styles, /\.learner-review-card\[open\]/);
  assert.match(styles, /@media\(max-width:650px\)[^{]*\{[^}]*\.learner-review-section/);
});
