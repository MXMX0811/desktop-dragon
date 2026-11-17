import {createGreetingScene} from '../../../shared/greetings/scene.js';
import {createNightFace} from './face.js';
export function createScene({canvas,size}){return createGreetingScene({canvas,size,name:'goodnight',base:new URL('./textures/',import.meta.url),createFace:createNightFace});}
