import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allMandatoryReviewed, projectKey, reviewRevision } from '../src/utils/reviewWorkflow.ts';
test('review approval requires all mandatory evidence and never passes an empty checklist',()=>{
  const rules=[{id:'a',importance:'Mandatory'},{id:'b',importance:'Important'}];
  assert.equal(allMandatoryReviewed([],[]),false);
  assert.equal(allMandatoryReviewed(rules,[]),false);
  assert.equal(allMandatoryReviewed(rules,[{requirement_id:'a',status:'met',evidence:''}]),false);
  assert.equal(allMandatoryReviewed(rules,[{requirement_id:'a',status:'met',evidence:'Degree certificate'}]),true);
});
test('review revision changes when candidate analysis or job conditions change',()=>{
  const base=reviewRevision({id:1,checklist_eval:'[]'},{checklist:'[]'});
  assert.notEqual(base,reviewRevision({id:1,checklist_eval:'new'},{checklist:'[]'}));
  assert.notEqual(base,reviewRevision({id:1,checklist_eval:'[]'},{checklist:'new'}));
  assert.equal(projectKey(' Project   A '),projectKey('project a'));
});
