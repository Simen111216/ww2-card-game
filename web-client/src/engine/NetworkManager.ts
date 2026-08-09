import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export type NetworkAction = 
  | { type: 'GUEST_READY', faction: string, deck: any[] }
  | { type: 'GAME_START', p1Faction: string, p2Faction: string }
  | { type: 'PLAY_CARD', index: number }
  | { type: 'MOVE_UNIT', index: number }
  | { type: 'ATTACK_UNIT', attackerIndex: number, defenderIndex: number }
  | { type: 'ATTACK_HQ', attackerIndex: number }
  | { type: 'END_TURN' }
  | { type: 'SYNC_STATE', state: any }
  | { type: 'VFX', cardId: string, isP1: boolean };

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
      if (this.onConnectionCb) this.onConnectionCb(this.conn);
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
      this.conn.send(data);
    }
  }
}

export const networkManager = new NetworkManager();
