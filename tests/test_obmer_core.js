#!/usr/bin/env node
// Regression tests run against the actual JavaScript embedded in Obmer HTML.
// Usage: node test_obmer_core.js obmer_v23.html ["obmer (4).json"]
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','index.html'),'utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);assert(match,'Missing embedded JS');
new vm.Script(match[1],{filename:'obmer.js'});
const els=new Map();
function el(id){if(!els.has(id))els.set(id,{id,value:id==='sigma'?'5':'',checked:true,style:{},classList:{toggle(){}},dataset:{},children:[],innerHTML:'',textContent:'',disabled:false,onclick:null,onchange:null,addEventListener(){},querySelectorAll(){return []},querySelector(){return {textContent:''}},closest(){return null},setAttribute(){},appendChild(){},replaceChildren(){},getBoundingClientRect(){return {width:1100,height:760}},createSVGPoint(){return {matrixTransform(){return {x:0,y:0}}}},getScreenCTM(){return {inverse(){return {}}}}});return els.get(id)}
const handlers={};const doc={getElementById:el,createElementNS(_ns,tag){return {tag,attributes:{},setAttribute(k,v){this.attributes[k]=v},appendChild(){},textContent:''}},addEventListener(name,fn){handlers[name]=fn}};
const ctx=vm.createContext({document:doc,console,Math,Number,Array,Set,Map,Date,JSON,Infinity,alert(){throw Error('Unexpected alert')},confirm(){return true},HTMLElement:class{},URL:{},Blob:class{},setTimeout(){}});
vm.runInContext(match[1],ctx,{timeout:10000});
let count=0;function test(name,fn){try{fn();console.log('PASS',name);count++}catch(e){console.error('FAIL',name,e.stack);process.exitCode=1}}
function load(project){vm.runInContext(`nodes=${JSON.stringify(project.nodes)};lines=${JSON.stringify(project.lines)};relations=${JSON.stringify(project.relations||[])};selected=null;multiSelected=[];selectedPoints=[];selectedRelation=null;`,ctx)}
function state(){return JSON.parse(vm.runInContext('JSON.stringify({nodes,lines,relations})',ctx))}
function freeze(){assert.equal(typeof el('freezeResiduals').onclick,'function');el('freezeResiduals').onclick()}
const example={nodes:[{id:1,x:0,y:0},{id:2,x:100,y:0},{id:3,x:200,y:0},{id:4,x:300,y:0},{id:5,x:400,y:0}],lines:[{id:5,a:1,b:2,d:990,s:null,axis:'free'},{id:9,a:2,b:3,d:1010,s:null,axis:'free'},{id:12,a:3,b:4,d:1000,s:0,axis:'free'},{id:13,a:4,b:5,d:990,s:2,axis:'free'}]};
test('null σ updated; σ=0 reference preserved; smaller σ preserved',()=>{load(example);const before=state().nodes;freeze();const ls=state().lines;assert(Math.abs(ls[0].s-10)<1e-8);assert(Math.abs(ls[1].s-10)<1e-8);assert.equal(ls[2].s,0);assert.equal(ls[3].s,2);assert.deepEqual(state().nodes,before)});
test('zero residual sets σ=0 when previously null',()=>{load({nodes:example.nodes,lines:[{id:1,a:1,b:2,d:1000,s:null,axis:'free'}]});freeze();assert.equal(state().lines[0].s,0)});
test('blank σ input stays null, not zero',()=>{load({nodes:example.nodes,lines:[{id:1,a:1,b:2,d:1000,s:null,axis:'free'}]});vm.runInContext('selected=1;renderSide(new Map())',ctx);assert.match(el('properties').innerHTML,/id="lineSigma"[^>]*value=""/);el('lineSigma').value='';el('lineSigma').onchange({target:el('lineSigma')});assert.equal(state().lines[0].s,null)});
test('explicit σ=0 is accepted in properties',()=>{load({nodes:example.nodes,lines:[{id:1,a:1,b:2,d:1000,s:2,axis:'free'}]});vm.runInContext('selected=1;renderSide(new Map())',ctx);el('lineSigma').value='0';el('lineSigma').onchange({target:el('lineSigma')});assert.equal(state().lines[0].s,0)});
test('ordinary length adjusted to measured length',()=>{load({nodes:[{id:1,x:0,y:0},{id:2,x:90,y:0}],lines:[{id:1,a:1,b:2,d:1000,s:1,axis:'free'}]});vm.runInContext('autoAdjust()',ctx,{timeout:10000});const n=state().nodes;assert(Math.abs(Math.hypot(n[0].x-n[1].x,n[0].y-n[1].y)*10-1000)<.01)});
test('exact σ=0 length enforced',()=>{load({nodes:[{id:1,x:0,y:0},{id:2,x:90,y:0}],lines:[{id:1,a:1,b:2,d:1000,s:0,axis:'free'}]});vm.runInContext('autoAdjust()',ctx,{timeout:10000});const n=state().nodes;assert(Math.abs(Math.hypot(n[0].x-n[1].x,n[0].y-n[1].y)*10-1000)<.01)});
test('contradictory reference lengths rejected without moving nodes',()=>{load({nodes:[{id:1,x:0,y:0},{id:2,x:100,y:0}],lines:[{id:1,a:1,b:2,d:1000,s:0,axis:'free'},{id:2,a:1,b:2,d:2000,s:0,axis:'free'}]});const before=state().nodes;vm.runInContext('autoAdjust()',ctx,{timeout:10000});assert.deepEqual(state().nodes,before);assert.match(el('status').textContent,/отклонено/)});
test('zero-length initial geometry can be solved',()=>{load({nodes:[{id:1,x:0,y:0},{id:2,x:0,y:0}],lines:[{id:1,a:1,b:2,d:1000,s:0,axis:'free'}]});vm.runInContext('autoAdjust()',ctx,{timeout:10000});const n=state().nodes;assert(Math.abs(Math.hypot(n[0].x-n[1].x,n[0].y-n[1].y)*10-1000)<.01)});
test('JSON project fixture: L5/L9/L12/L13 null σ becomes measured residual',()=>{const file=process.argv[3]||path.join(__dirname,'fixtures','example.json');if(!fs.existsSync(file)){console.log('SKIP: JSON fixture not supplied');return}const p=JSON.parse(fs.readFileSync(file,'utf8'));load(p);const expected=new Map();for(const l of p.lines){if(![5,9,12,13].includes(l.id))continue;const a=p.nodes.find(n=>n.id===l.a),b=p.nodes.find(n=>n.id===l.b);expected.set(l.id,Math.abs(Math.hypot(a.x-b.x,a.y-b.y)*10-l.d))}freeze();for(const id of [5,9,12,13]){const l=state().lines.find(l=>l.id===id);assert.notEqual(l.s,null);assert(Math.abs(l.s-expected.get(id))<1e-7,`L${id}: ${l.s} != ${expected.get(id)}`)}});

const relationProject={nodes:[{id:1,x:0,y:0},{id:2,x:100,y:0},{id:3,x:0,y:100}],lines:[{id:1,a:1,b:2,d:null,s:null,axis:'free'},{id:2,a:1,b:3,d:null,s:null,axis:'free'}],relations:[{id:12345,type:'horizontal',a:1,b:null,point:null},{id:67890,type:'perpendicular',a:1,b:2,point:null}]};
test('selecting a relation replaces available-relations panel with delete button',()=>{load(relationProject);vm.runInContext('selectRelationObjects(12345)',ctx);assert.equal(vm.runInContext('selectedRelation',ctx),12345);assert.match(el('contextRelations').innerHTML,/Удалить привязку/);assert.doesNotMatch(el('contextRelations').innerHTML,/Горизонтальность.*Вертикальность/);assert.equal(typeof el('deleteSelectedRelation').onclick,'function')});
test('Delete removes only selected relation, preserves objects and their selection',()=>{load(relationProject);vm.runInContext('selectRelationObjects(12345);deleteSelected()',ctx);const s=state();assert.equal(s.relations.length,1);assert.equal(s.relations[0].id,67890);assert.equal(s.lines.length,2);assert.equal(vm.runInContext('selected',ctx),1);assert.equal(vm.runInContext('selectedRelation',ctx),null);assert.equal(JSON.stringify(vm.runInContext('multiSelected',ctx)),JSON.stringify([1]));assert.match(el('contextRelations').innerHTML,/relation-option|Выбрано/)});
test('second Delete removes selected objects',()=>{load(relationProject);vm.runInContext('selectRelationObjects(12345);deleteSelected();deleteSelected()',ctx);assert.equal(state().lines.length,1);assert.equal(state().lines[0].id,2)});
test('delete button removes selected relation without deleting objects',()=>{load(relationProject);vm.runInContext('selectRelationObjects(12345)',ctx);el('deleteSelectedRelation').onclick();assert.equal(state().lines.length,2);assert.equal(state().relations.length,1);assert.equal(vm.runInContext('selectedRelation',ctx),null)});
test('selecting ordinary line cancels relation selection',()=>{load(relationProject);vm.runInContext('selectRelationObjects(12345);chooseLine(2)',ctx);assert.equal(vm.runInContext('selectedRelation',ctx),null);assert.equal(vm.runInContext('selected',ctx),2)});
test('point-line relation keeps point selection after relation removal',()=>{const p=structuredClone(relationProject);p.relations=[{id:999,type:'pointline',a:1,b:null,point:3}];load(p);vm.runInContext('selectRelationObjects(999);deleteSelected()',ctx);assert.equal(JSON.stringify(vm.runInContext('selectedPoints',ctx)),JSON.stringify([3]));assert.equal(vm.runInContext('selected',ctx),1)});

function initUndo(p){load(p);vm.runInContext('resetUndoHistory();render()',ctx)}
test('removed obsolete toolbar buttons, preserved selection and drawing tools',()=>{assert(!html.includes('id="bindTool"'));assert(!html.includes('id="relationTool"'));assert(html.includes('id="selectTool"'));assert(html.includes('id="drawTool"'));assert(html.includes('id="rulerTool"'))});
test('undo restores deleted relation and geometry, one action at a time',()=>{initUndo(relationProject);vm.runInContext('selectRelationObjects(12345);deleteSelected();deleteSelected()',ctx);assert.equal(state().lines.length,1);vm.runInContext('undoLastAction()',ctx);assert.equal(state().lines.length,2);assert.equal(state().relations.length,1);vm.runInContext('undoLastAction()',ctx);assert.equal(state().relations.length,2)});
test('undo restores edited measured dimension and previous coordinates',()=>{initUndo({nodes:[{id:1,x:0,y:0},{id:2,x:100,y:0}],lines:[{id:1,a:1,b:2,d:null,s:null,axis:'free'}]});const before=state();vm.runInContext('lines[0].d=1100;autoAdjust();render()',ctx);assert.equal(state().lines[0].d,1100);vm.runInContext('undoLastAction()',ctx);assert.deepEqual(state(),before)});
test('multiple renders while dragging create only one undo step',()=>{initUndo({nodes:[{id:1,x:0,y:0},{id:2,x:100,y:0}],lines:[{id:1,a:1,b:2,d:null,s:null,axis:'free'}]});vm.runInContext('drag=2;nodes[1].x=110;render();nodes[1].x=120;render();drag=null;render()',ctx);assert.equal(vm.runInContext('undoStack.length',ctx),1);vm.runInContext('undoLastAction()',ctx);assert.equal(state().nodes[1].x,100)});
test('Ctrl+Z and Cmd+Z keyboard shortcuts trigger undo',()=>{for(const modifier of ['ctrlKey','metaKey']){initUndo(relationProject);vm.runInContext('deleteSelectedRelation=deleteSelectedRelation;selectRelationObjects(12345);deleteSelected()',ctx);let prevented=false;handlers.keydown({key:'z',[modifier]:true,altKey:false,target:{tagName:'DIV',isContentEditable:false},preventDefault(){prevented=true}});assert(prevented);assert.equal(state().relations.length,2)}});
test('undo does not record selection-only changes',()=>{initUndo(relationProject);vm.runInContext('chooseLine(1);chooseLine(2);render()',ctx);assert.equal(vm.runInContext('undoStack.length',ctx),0)});


// Regression: relation icons use the same rotated local frame as line labels.
test('relation icons are compact and equally offset on both horizontal and vertical lines',()=>{
 const source=html.slice(html.indexOf('function drawRelationIcons(){'),html.indexOf("svg.addEventListener('keydown',e=>{const icon"));
 assert.match(source,/rotate\(\$\{angle\}\)/);
 assert.match(source,/const size=14\*u,step=18\*u,offset=10\*u/);
 assert.match(source,/y:offset-size\/2/);
 assert.match(source,/if\(angle>90\)angle-=180;if\(angle< -90\)angle\+=180/);
 assert.doesNotMatch(source,/my\+19\*u/);
});

// AutoCAD DXF regression tests (run against embedded production function).
function dxfEntities(dxf){const pairs=dxf.trim().split(/\r?\n/);assert.equal(pairs.length%2,0);const out=[];for(let i=0;i<pairs.length;i+=2)out.push([pairs[i],pairs[i+1]]);return out}
test('DXF export button is present and wired',()=>{assert(html.includes('id="exportDxf"'));assert.equal(typeof el('exportDxf').onclick,'function')});
test('DXF exports one LINE per segment in mm, Y upward',()=>{load({nodes:[{id:1,x:1.5,y:2},{id:2,x:101.5,y:22}],lines:[{id:1,a:1,b:2,d:1000,s:1,axis:'free'}]});vm.runInContext('solution=null',ctx);const p=dxfEntities(vm.runInContext('buildAdjustedDXF()',ctx));const at=k=>p.find(([a])=>a===String(k))?.[1];assert.equal(p.filter(([k,v])=>k==='0'&&v==='LINE').length,1);assert.equal(at(10),'15');assert.equal(at(20),'-20');assert.equal(at(11),'1015');assert.equal(at(21),'-220');assert.equal(at(8),'ADJUSTED');assert.equal(at(1),'AC1009')});
test('DXF exports yellow solution coordinates when present',()=>{load({nodes:[{id:1,x:0,y:0},{id:2,x:10,y:0}],lines:[{id:1,a:1,b:2,d:null,s:null,axis:'free'}]});vm.runInContext('solution={1:{x:3,y:4},2:{x:5,y:6}}',ctx);const p=dxfEntities(vm.runInContext('buildAdjustedDXF()',ctx));assert(p.some(([k,v])=>k==='10'&&v==='30'));assert(p.some(([k,v])=>k==='21'&&v==='-60'))});
test('DXF rejects invalid endpoint coordinates',()=>{load({nodes:[{id:1,x:0,y:0}],lines:[{id:1,a:1,b:999,d:null,s:null,axis:'free'}]});vm.runInContext('solution=null',ctx);assert.throws(()=>vm.runInContext('buildAdjustedDXF()',ctx),/L1/)});

// UI regression tests for v23.
test('obsolete endpoint-binding panel is not visible',()=>{
 assert(!html.includes('<b>Привязки концов</b>'));
 assert(html.includes('id="contextRelations"'));
 assert(html.includes('id="mergePoints"')); // compatibility for existing event handlers
});
test('line properties omit obsolete endpoint hint',()=>{
 assert(!html.includes('Для соединения с другой линией используй инструмент'));
 assert(!html.includes('Концы: P${l.a}'));
});
test('sigma explanation is concise and correct',()=>{
 assert(html.includes('Чем меньше σ, тем сильнее размер влияет на расчёт.'));
 assert(html.includes('σ — точность замера, а не невязка.'));
});

console.log(`${count} tests passed${process.exitCode?' (some failed)':''}`);
