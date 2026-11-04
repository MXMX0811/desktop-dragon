// User-provided character dialogue; these lines are not session facts.
export const DIALOGUES={
 standby:['诶？主人在叫我吗？','嘿嘿，我在这里哦～'],
 sleep:['呼噜……再睡五分钟……'],
 thinking:['唔……让我想想……','好像有点头绪了！','脑袋正在转圈圈……'],
 reading:['翻翻看这里有没有答案～','这本书好厚呀……','找到有趣的东西了！'],
 work:['噼里啪啦！努力工作中！','这段代码看起来有点眼熟……','主人不许偷看我的屏幕！'],
 drawing:['再添一点颜色……','嘿嘿，猜猜我在画什么？','这里要画得漂亮一点！'],
 waiting:['主人，这里需要你看一眼哦～','我先在这里等你啦。','唔……这个得由主人决定。'],
 subagents:['小云朵们出发啦！','大家一起帮忙，嘿咻！','不要转晕了呀，小云朵～'],
 drag:['哇哇！要飞起来啦！'],
 peek:['嘿嘿，被发现啦！','我就在这里偷偷看着～'],
};

export function dialogueGroup(context){
 if(context.mode==='drag'||context.mode==='peek')return context.mode;
 if(context.sleeping)return 'sleep';
 if(context.waiting)return 'waiting';
 if(context.hasAgents&&context.scene!=='standby')return 'subagents';
 return context.scene;
}

export function randomLine(group,previous,random=Math.random){
 const lines=DIALOGUES[group];
 const choices=lines.length>1?lines.filter(line=>line!==previous):lines;
 return choices[Math.floor(random()*choices.length)];
}
