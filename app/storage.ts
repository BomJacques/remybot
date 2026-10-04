import {z} from 'zod';
import {transition, type Action, type Pet} from './engine.ts';

export const SAVE_KEY = 'remybot.pet.v1';
export const SAVE_LOCK = 'remybot.pet.write';
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type SavePacket = {pet:Pet|null; revision:number};

export class SaveError extends Error {
  readonly code:'unavailable'|'invalid'|'unsupported'|'conflict';
  constructor(code:SaveError['code'], message:string) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
  }
}

const kind = z.enum(['body', 'mind', 'heart']);
const timestamp = z.string().datetime({offset:true});
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const time = Date.parse(value+'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value;
});
const stage = z.number().int().nonnegative().safe();
const commitment = z.object({
  id:z.string().min(1).max(64), label:z.string().min(1).max(90).refine(value=>!!value.trim()), kind,
}).strict();
const commitments = z.array(commitment).min(1).max(6).refine(items=>new Set(items.map(item=>item.id)).size===items.length);
const petSchema = z.object({
  egg:z.number().int().min(0).max(5),
  name:z.string().min(1).max(24).refine(value=>!!value.trim()),
  bornDate:calendarDate, bornAt:timestamp, hatchStorySeen:z.boolean().optional(),
  timezone:z.string().refine(value=>{try {new Intl.DateTimeFormat('en', {timeZone:value}); return true;} catch {return false;}}),
  commitments,
  checkins:z.record(calendarDate,z.object({
    items:z.array(commitment.extend({done:z.boolean()})).min(1).max(6).refine(items=>new Set(items.map(item=>item.id)).size===items.length),
    savedAt:timestamp,
  }).strict()),
  food:z.object({level:z.number().int().min(0).max(3), decayAt:timestamp}).strict(),
  pettedDate:calendarDate.nullable(), fedDates:z.array(calendarDate),
  revealedStage:stage, highestStage:stage,
  cocoon:z.object({startedAt:timestamp, endsAt:timestamp, targetStage:stage, trait:kind}).strict().nullable().optional(),
  restUntil:timestamp.nullable().optional(), restedAt:timestamp.optional(),
  forms:z.array(z.object({stage,trait:kind,at:calendarDate}).strict()).min(1),
}).strict().refine(pet=>pet.highestStage>=pet.revealedStage && pet.forms[0]?.stage===0 &&
  pet.forms.at(-1)?.stage===pet.revealedStage && pet.forms.every((form,index)=>index===0||form.stage>pet.forms[index-1].stage) &&
  (!pet.cocoon || (pet.cocoon.targetStage>pet.revealedStage && pet.cocoon.targetStage<=pet.highestStage &&
    Date.parse(pet.cocoon.endsAt)-Date.parse(pet.cocoon.startedAt)===60000)));
const saveSchema = z.object({version:z.literal(1), revision:z.number().int().positive().safe(), savedAt:timestamp, pet:petSchema}).strict();

function readRaw(storage:SaveStorage) {
  try {return storage.getItem(SAVE_KEY);}
  catch {throw new SaveError('unavailable','This browser cannot open saved progress. Allow website storage, then try again.');}
}

function decode(raw:string|null):SavePacket {
  if(raw===null) return {pet:null,revision:0};
  let value:unknown;
  try {value=JSON.parse(raw);}
  catch {throw new SaveError('invalid','This browser’s saved progress could not be read. It has been kept unchanged.');}
  if(value && typeof value==='object' && 'version' in value && value.version!==1) {
    throw new SaveError('unsupported','This save needs a different version of Remybot. Your saved progress has been kept unchanged.');
  }
  const result=saveSchema.safeParse(value);
  if(!result.success) throw new SaveError('invalid','This browser’s saved progress could not be read. It has been kept unchanged.');
  return {pet:result.data.pet,revision:result.data.revision};
}

/** Never replaces or repairs an unreadable save silently. */
export function readSavedPet(storage:SaveStorage):SavePacket {
  return decode(readRaw(storage));
}

/** Reads the latest save inside the caller's browser lock, rather than trusting a stale UI snapshot. */
export function applySavedAction(storage:SaveStorage, action:Action, now=new Date()):SavePacket {
  const before=readRaw(storage);
  const current=decode(before);
  const pet=transition(current.pet,action,now);
  const next={version:1 as const,revision:current.revision+1,savedAt:now.toISOString(),pet};
  if(!saveSchema.safeParse(next).success) throw new SaveError('invalid','That update could not be saved. Your previous progress is unchanged.');
  if(readRaw(storage)!==before) throw new SaveError('conflict','Progress changed in another tab. Load it again, then retry your action.');
  try {storage.setItem(SAVE_KEY,JSON.stringify(next));}
  catch {throw new SaveError('unavailable','That update was not saved. This browser’s storage may be full or blocked. Free some space or allow website storage, then try again.');}
  return {pet,revision:next.revision};
}
