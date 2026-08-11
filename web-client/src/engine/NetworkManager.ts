import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export type NetworkAction = 
  | { type: 'GUEST_READY', faction: string, deckCounts: Record<string, number> }
  | { type: 'HOST_INFO', faction: string }
  | { type: 'GAME_START', p1Faction: string, p2Faction: string }
  | { type: 'PLAY_CARD', index: number }
  | { type: 'MOVE_UNIT', index: number }
  | { type: 'ATTACK_UNIT', attackerIndex: number, defenderIndex: number }
  | { type: 'ATTACK_HQ', attackerIndex: number }
  | { type: 'END_TURN' }
  | { type: 'USE_SKILL' }
  | { type: 'SYNC_STATE', state: any }
  | { type: 'VFX', cardId: string, isP1: boolean }
  | { type: 'START_PLAY_ANIM', index: number, isP1: boolean, card: any }
  | { type: 'START_ATTACK_ANIM', attackerId: string, defenderId: string, isP1: boolean }
  | { type: 'SPAWN_TRANSIENT_VFX', vfxType: 'damage' | 'heal' | 'armor' | 'death', text: string, targetId: string, isP1: boolean };

export class NetworkManager {
  private peer: Peer | null = null;
  public conn: DataConnection | null = null;
  public isHost: boolean = false;
  public peerId: string | null = null;
  
  public onConnectionCb?: (conn: DataConnection) => void;
  public onDataCb?: (data: NetworkAction) => void;
  public onOpenCb?: (id: string) => void;
  public onCloseCb?: () => void;

  constructor() {}

  public initHost() {
    this.isHost = true;
    this.peer = new Peer();
    
    this.peer.on('open', (id) => {
      this.peerId = id;
      if (this.onOpenCb) this.onOpenCb(id);
    });

    this.peer.on('connection', (connection) => {
      this.conn = connection;
      this.setupConnection();
      if (this.onConnectionCb) this.onConnectionCb(connection);
    });
  }

  public initClient(hostId: string) {
    this.isHost = false;
    this.peer = new Peer();
    
    this.peer.on('open', (id) => {
      this.peerId = id;
      this.conn = this.peer!.connect(hostId);
      this.setupConnection();
      // Wait for connection to actually open before calling callback
      this.conn.on('open', () => {
        if (this.onConnectionCb) this.onConnectionCb(this.conn!);
      });
    });
  }

  private setupConnection() {
    if (!this.conn) return;
    this.conn.on('open', () => {
      console.log('Network connected!');
    });
    this.conn.on('data', (data) => {
      if (this.onDataCb) this.onDataCb(data as NetworkAction);
    });
    this.conn.on('close', () => {
      console.log('Network disconnected!');
      if (this.onCloseCb) this.onCloseCb();
    });
  }

  public send(data: NetworkAction) {
    if (this.conn && this.conn.open) {
      try {
        // 使用 JSON.parse(JSON.stringify) 剔除对象中可能存在的不可序列化属性（如函数）
        // 避免 PeerJS 底层的 DataChannel 报 DataCloneError
        const safeData = JSON.parse(JSON.stringify(data));
        this.conn.send(safeData);
      } catch (e) {
        console.error("Network send error:", e);
      }
    }
  }
}

export const networkManager = new NetworkManager();
