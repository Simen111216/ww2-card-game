import { CardType, Faction, Keyword } from './types';
import type { BaseCard, UnitCard, OrderCard, EnvironmentCard, HQCard } from './types';

export class Player {
  public name: string;
  public faction: Faction;
  public hqHp: number = 25;
  
  public cp: number = 0; // 当前指挥点
  public maxCp: number = 0; // 当前回合最大指挥点，上限30
  
  public deck: BaseCard[] = [];
  public hand: BaseCard[] = [];
  public graveyard: BaseCard[] = [];
  public board: UnitCard[] = [];

  constructor(name: string, faction: Faction, deck: BaseCard[]) {
    this.name = name;
    this.faction = faction;
    this.deck = [...deck];
    this.shuffleDeck();
  }

  // 洗牌
  private shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  // 抽牌逻辑
  public drawCard(amount: number = 1) {
    for (let i = 0; i < amount; i++) {
      if (this.deck.length === 0) {
        console.log(`${this.name} 的牌库已空！`);
        break;
      }
      const card = this.deck.pop()!;
      if (this.hand.length >= 10) {
        console.log(`${this.name} 手牌已满(10张)，新抽的牌 [${card.name}] 必须被弃掉！`);
        this.graveyard.push(card);
      } else {
        this.hand.push(card);
        console.log(`${this.name} 抽到了 [${card.name}]`);
      }
    }
  }

  // 弃牌逻辑
  public discardCard(cardIndex: number) {
    if (cardIndex >= 0 && cardIndex < this.hand.length) {
      const card = this.hand.splice(cardIndex, 1)[0];
      this.graveyard.push(card);
      console.log(`${this.name} 弃掉了 [${card.name}]`);
    }
  }

  // 回合开始时的处理
  public startTurn() {
    // 指挥点随回合推进逐渐增加，最大为30
    if (this.maxCp < 30) {
      this.maxCp++;
    }
    this.cp = this.maxCp;
    console.log(`${this.name} 回合开始，当前最大指挥点为 ${this.maxCp}。`);

    // 重置场上单位的移动和攻击状态
    this.board.forEach(unit => {
      unit.hasMovedThisTurn = false;
      unit.hasAttackedThisTurn = false;
    });

    // 每过一个回合抽一张牌
    this.drawCard(1);
  }

  // 部署单位或使用指令
  public playCard(cardIndex: number, game?: any): boolean {
    if (cardIndex < 0 || cardIndex >= this.hand.length) return false;
    const card = this.hand[cardIndex];

    if (this.cp < card.deployCost) {
      console.log(`指挥点不足！部署 [${card.name}] 需要 ${card.deployCost} 点，当前仅有 ${this.cp} 点。`);
      return false;
    }

    this.cp -= card.deployCost;
    this.hand.splice(cardIndex, 1);

    if (card.type === CardType.UNIT) {
      const u = card as UnitCard;
      // 刚部署的单位，如果没有“闪击”词条，则本回合不可攻击 (Summoning Sickness)
      u.hasAttackedThisTurn = !u.keywords.includes(Keyword.BLITZ);
      u.hasMovedThisTurn = true;
      this.board.push(u);
      console.log(`${this.name} 部署了单位 [${card.name}]`);
    } else if (card.type === CardType.ORDER) {
      console.log(`${this.name} 使用了指令卡 [${card.name}]`);
      if (game) {
        (card as OrderCard).effect(game);
      }
      this.graveyard.push(card);
    } else if (card.type === CardType.ENVIRONMENT) {
      console.log(`${this.name} 使用了环境卡 [${card.name}]`);
      if (game) {
        (card as EnvironmentCard).effect(game);
      }
      this.graveyard.push(card);
    }

    return true;
  }

  // 受到伤害
  public takeHqDamage(damage: number) {
    this.hqHp -= damage;
    console.log(`${this.name} 的总部受到了 ${damage} 点伤害，剩余血量: ${this.hqHp}`);
    if (this.hqHp <= 0) {
      console.log(`${this.name} 的总部血量清零，游戏失败！`);
    }
  }
}
