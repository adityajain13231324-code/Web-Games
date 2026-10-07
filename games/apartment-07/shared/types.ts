export type Point = { x: number; y: number };
export type Rect = Point & { w: number; h: number };
export type Direction = 'down' | 'up' | 'left' | 'right';
export interface AvatarConfig { skin: number; hair: number; hairColor: number; top: number; bottom: number; accessory: number; topColor: number; bottomColor: number }
export interface Player extends Point { id: string; name: string; avatar: AvatarConfig; direction: Direction; moving: boolean; running: boolean; connected: boolean; arrived: boolean; inputSeq: number }
export interface RoomDefinition extends Rect { id: string; name: string; subtitle: string; floor: string; wall: string }
export interface DoorDefinition extends Rect { id: string; rooms: [string,string]; label: string; horizontal: boolean; interaction: string }
export interface Furniture extends Rect { kind: string; color?: string; solid?: boolean }
export interface InteractableDefinition extends Point { id: string; room: string; name: string; icon: string; kind: string; approach?: Point }
export interface MapDefinition { id: string; name: string; width: number; height: number; tile: number; spawn: Point; rooms: RoomDefinition[]; doors: DoorDefinition[]; furniture: Furniture[]; interactables: InteractableDefinition[] }
export interface PuzzleDefinition { id: string; prerequisites: string[]; actions: string[]; completion: string; rewards: string[]; hints: [string,string,string]; goal: string }
export interface Clue { id: string; title: string; text: string; room: string }
export interface Item { id: string; name: string; description: string; icon: string }
export interface Action { id: string; label: string; item?: string }
export interface Inspection { id: string; title: string; subtitle: string; text: string; kind: string; actions: Action[]; lockedBy?: string; controls?: { type: 'code' | 'sequence' | 'overlay' | 'hook' | 'tin' | 'suitcase' | 'selector'; options?: string[] }; solved: boolean }
export interface ChatLine { id: number; name: string; text: string; system?: boolean }
export interface Snapshot { roomCode: string; hostId: string; phase: 'lobby'|'playing'|'won'; startedAt: number; players: Player[]; inventory: Item[]; clues: Clue[]; flags: string[]; doors: string[]; chat: ChatLine[]; locks: Record<string,string>; hintCounts: Record<string,number>; pings: {id: string; name: string; x: number; y: number; until: number}[]; objectives: string[] }
export const SKINS = ['#f0c6a2','#dca67d','#bd815d','#a36948','#80513c','#57392f'];
export const HAIR = ['#2b2524','#583b2b','#815331','#b78442','#d9bd78','#a65338','#69677a','#302d50'];
export const COLORS = ['#d59d52','#71988a','#7d9fb8','#b87470','#8f80a6','#ddd4bf','#485869','#a4ac70'];
export const DEFAULT_AVATAR: AvatarConfig = { skin: 1, hair: 0, hairColor: 0, top: 0, bottom: 0, accessory: 0, topColor: 0, bottomColor: 6 };
export function cleanAvatar(value: Partial<AvatarConfig> = {}): AvatarConfig { const a={...DEFAULT_AVATAR}; for(const [key,max] of Object.entries({skin:6,hair:6,hairColor:8,top:4,bottom:3,accessory:5,topColor:8,bottomColor:8})){ const v=value[key as keyof AvatarConfig]; if(typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<max) a[key as keyof AvatarConfig]=v; } return a; }

/** Movement speeds in world pixels per second. Shared so client prediction and server validation agree. */
export const WALK_SPEED = 150;
export const RUN_SPEED = 250;
