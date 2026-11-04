const asyncTool='request_user_input_async';
const replyStart='<send_user_message_question_reply>',replyEnd='</send_user_message_question_reply>';

// Read only the host's question bookkeeping. Questions and answers never leave
// the receiver's memory, even when the same payload contains their full text.
export function inputLifecycle(input){
 const result={};
 if(input.tool_name===asyncTool){
  const questions=input.tool_input?.questions;
  if(Array.isArray(questions))result.input_question_count=questions.length;
  if(input.hook_event_name==='PostToolUse'){
   let response=input.tool_response;
   if(typeof response==='string'){
    try{response=JSON.parse(response);}catch{return result;}
   }
   if(typeof response?.accepted==='boolean')result.input_request_accepted=response.accepted;
  }
 }
 if(input.hook_event_name==='UserPromptSubmit'){
  const prompt=typeof input.prompt==='string'?input.prompt.trim():'';
  if(!prompt.startsWith(replyStart)||!prompt.endsWith(replyEnd))return result;
  let rows;
  try{rows=JSON.parse(prompt.slice(replyStart.length,-replyEnd.length));}catch{return result;}
  if(!Array.isArray(rows))return result;
  const replies=[];
  for(const row of rows){
   if(typeof row?.questionItemId!=='string')continue;
   let id;
   try{id=JSON.parse(row.questionItemId);}catch{continue;}
   if(Array.isArray(id)&&id.length===3&&id[0]===asyncTool&&typeof id[1]==='string'&&id[1]&&Number.isInteger(id[2])&&id[2]>=0){
    replies.push({tool_use_id:id[1],question_index:id[2]});
   }
  }
  if(replies.length)result.input_replies=replies;
 }
 return result;
}
