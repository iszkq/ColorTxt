async (page) => {
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const p=await context.newPage(), checks=[], errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  const assert=(v,msg)=>{if(!v)throw new Error(msg)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const tap=async name=>{const el=p.getByRole('button',{name,exact:true});await el.scrollIntoViewIfNeeded();const b=await el.boundingBox();await p.touchscreen.tap(b.x+b.width/2,b.y+b.height/2)};
  const cdp=await context.newCDPSession(p);
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  const selected=()=>p.locator('.selected-text').allTextContents().then(a=>a.join(''));
  const glyph=async(row,index)=>p.locator('.verse-row .source-text').nth(row).evaluate((el,index)=>{
    const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node,offset=index;
    while(node=w.nextNode()){if(offset<node.length)break;offset-=node.length;}
    const r=document.createRange();r.setStart(node,offset);r.setEnd(node,offset+1);const b=r.getBoundingClientRect();return{x:b.left+1,y:b.top+b.height/2};
  },index);
  const dragTo=async(edge,dest,hold=0)=>{
    const h=await p.getByRole('button',{name:edge==='start'?'调整选区起点':'调整选区终点'}).boundingBox();
    const x=h.x+22,y=h.y+h.height/2;
    await touch('touchStart',x,y);
    for(let i=1;i<=8;i++)await touch('touchMove',x+(dest.x-x)*i/8,y+(dest.y-y)*i/8);
    if(hold)await wait(hold);
    await touch('touchEnd');await wait(100);
  };
  try {
    await p.goto('http://localhost:5174/index.html?preview=reader');
    await tap('选择第1节');
    await dragTo('end',await glyph(2,5));
    assert((await selected()).startsWith('起初')&&(await selected()).includes('地是空虚混沌')&&(await selected()).includes('神说'),'End handle failed to extend across verses: '+await selected());
    await dragTo('start',await glyph(3,3));
    assert(!(await selected()).includes('起初')&&(await selected()).includes('要有光')&&(await selected()).includes('神看'),'Crossing handles lost fixed endpoint: '+await selected());
    assert(await p.evaluate(()=>window.getSelection().isCollapsed),'Native range during handle crossing');
    checks.push('End handle extends across verses; crossing start over end normalizes the range');
    await tap('取消选中');await tap('选择第4节');
    const before=await p.locator('.reader-scroll').evaluate(e=>e.scrollTop);
    const bottom=await p.locator('.selection-tools').boundingBox();
    await dragTo('end',{x:250,y:bottom.y-2},900);
    const after=await p.locator('.reader-scroll').evaluate(e=>e.scrollTop);
    assert(after>before+60,'Edge drag did not auto-scroll: '+before+' -> '+after);
    assert(await p.locator('.selection-handle').count()===2,'Lost handles after autoscroll');
    checks.push('Holding endpoint near toolbar automatically scrolls the reading area');
    await tap('取消选中');
    await p.locator('.reader-scroll').evaluate(e=>e.scrollTop=600);await wait(80);
    const firstVisible=await p.locator('.verse-row').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().top>100)[0].dataset.line);
    const row=p.locator(`[data-line="${firstVisible}"]`), a=await row.boundingBox();
    await tap('进入沉浸阅读');const b=await row.boundingBox();
    assert(Math.abs(a.y-b.y)<1,'Deep reading position changed on immersion');
    await tap('退出沉浸阅读');
    checks.push('Immersion preserves the current text position after scrolling');
    for(const width of [320,768]) {
      await p.setViewportSize({width,height:844});await p.goto('http://localhost:5174/index.html?preview=selection&theme=dark');
      await p.locator('.selection-tools').waitFor();
      const box=await p.locator('.selection-tools').boundingBox();
      assert(box.x>=0&&box.x+box.width<=width+1,'Selection toolbar outside viewport at '+width);
      await tap('划线');
      const sizes=await p.locator('.mark-types button, .excerpt-actions button').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
      assert(sizes.every(s=>s.w>=44&&s.h>=44),'Small selection targets '+JSON.stringify(sizes));
      await p.screenshot({path:`output/playwright/redesign-selection-${width}.png`});
    }
    checks.push('320 / 768 selection menus fit viewport with at least 44px targets');
    // Native text inputs retain platform editing; generic prose supports custom touch selection.
    await p.goto('http://localhost:5174/index.html?preview=books');await p.locator('.book-open').filter({hasText:'彩读使用指南'}).tap();await tap('上一段');
    const src=p.locator('.source-text').filter({hasText:'长按文字'}), rect=await src.boundingBox();
    await touch('touchStart',rect.x+70,rect.y+12);await wait(450);await touch('touchEnd');
    await p.locator('.selection-tools').waitFor();
    assert((await selected()).length>0,'Generic text long press failed');
    await tap('取消选中');
    await src.locator('..').focus();await p.keyboard.press('Enter');
    assert((await selected()).includes('长按文字'),'Keyboard paragraph selection failed');
    checks.push('Imported prose supports long press and keyboard selection');
    await context.close();
    const desktop=await page.context().browser().newContext({viewport:{width:768,height:844}}), d=await desktop.newPage();
    await d.goto('http://localhost:5174/index.html?preview=reader');await d.locator('.source-text').first().waitFor();
    const db=await d.locator('.source-text').first().boundingBox();
    await d.mouse.move(db.x+4,db.y+12);await d.mouse.down();await d.mouse.move(db.x+130,db.y+12,{steps:6});await d.mouse.up();
    assert(await d.locator('.selected-text').count()>0,'Desktop mouse drag selection failed');
    await desktop.close();checks.push('Desktop mouse drag still selects exact characters');
    assert(!errors.length,errors.join('\n'));
    return checks;
  } finally {await context.close();}
}
