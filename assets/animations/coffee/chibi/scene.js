import {createGreetingScene} from '../../../shared/greetings/scene.js';
import {createCoffeeFace} from './face.js';
export function createScene({canvas,size}){return createGreetingScene({canvas,size,name:'coffee',base:new URL('./textures/',import.meta.url),createFace:createCoffeeFace});}
