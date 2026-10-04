import {env} from 'cloudflare:workers';
import type {Pet} from '../app/engine';
function db(){if(!env.DB)throw new Error('Companion storage is unavailable.');return env.DB;}
export async function readPet(user:string){const row=await db().prepare('SELECT state, revision FROM companions WHERE user_id = ?').bind(user).first<{state:string;revision:number}>();return {pet:row?JSON.parse(row.state) as Pet:null,revision:row?.revision??0};}
export async function writePet(user:string,pet:Pet,revision:number){const result=revision===0?await db().prepare('INSERT INTO companions (user_id,state,revision) VALUES (?,?,1) ON CONFLICT(user_id) DO NOTHING').bind(user,JSON.stringify(pet)).run():await db().prepare('UPDATE companions SET state = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?').bind(JSON.stringify(pet),user,revision).run();return result.meta.changes===1;}
