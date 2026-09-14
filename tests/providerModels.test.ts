import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchGeminiModels, normalizeModelId} from '../src/utils/providerModels.ts';

test('Gemini discovery follows pagination and filters non-generative models', async()=>{
 let calls=0;
 const request=(async(url: URL, options: RequestInit)=>{
  assert.equal(url.searchParams.has('key'),false);
  assert.equal((options.headers as Record<string,string>)['x-goog-api-key'],'test');
  calls++;
  if(calls===1) return Response.json({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}],nextPageToken:'next+page'});
  assert.equal(url.searchParams.get('pageToken'),'next+page');
  return Response.json({models:[{name:'models/gemini-3-flash-preview',supportedGenerationMethods:['generateContent']},{name:'models/embedding',supportedGenerationMethods:['embedContent']}]});
 }) as typeof fetch;
 assert.deepEqual(await fetchGeminiModels('test',request),['gemini-2.5-flash','gemini-3-flash-preview']);
 assert.equal(calls,2);
});
test('discovery fails rather than returning a misleading partial list', async()=>{
 let calls=0;
 const request=(async()=>++calls===1?Response.json({models:[],nextPageToken:'next'}):Response.json({error:{message:'Denied'}},{status:403})) as typeof fetch;
 await assert.rejects(fetchGeminiModels('test',request),/Denied/);
});
test('model ID validation rejects display names and placeholders',()=>{
 assert.equal(normalizeModelId(' models/gemini-3-flash-preview '),'gemini-3-flash-preview');
 for(const input of ['Gemini 3 Flash','Custom','custom-model','',null,'models/']) assert.throws(()=>normalizeModelId(input));
});
