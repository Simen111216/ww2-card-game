import React, { useState, useEffect } from 'react';
import type { BaseCard, UnitCard, OrderCard, EnvironmentCard } from '../engine/types';
import { Faction, CardType, UnitCategory, Keyword } from '../engine/types';
import { CardComponent } from './CardComponent';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    getSovietUnits, getGermanUnits, getUSAUnits, getUKUnits, getFranceUnits,
    createSovietOrders, createGermanOrders, createUSAOrders, createUKOrders, createFranceOrders, createGenericOrders,
    ADVANCED_CARDS_DATA, ADVANCED_ORDERS_DATA, ENVIRONMENT_CARDS_DATA 
} from '../App';

interface DeckBuilderProps {
  onClose: () => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ onClose }) => {
  const [faction, setFaction] = useState<Faction>(Faction.SOVIET);
  const [deck, setDeck] = useState<any[]>([]); // Array of card templates
  const [availableCards, setAvailableCards] = useState<any[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [savedDecks, setSavedDecks] = useState<Record<string, Record<string, number>>>({}); // faction -> { templateId: count }

  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem('unlockedCards') || '[]');
      setUnlockedIds(ids);
      const decks = JSON.parse(localStorage.getItem('customDecks') || '{}');
      setSavedDecks(decks);
    } catch(e) {}
  }, []);

  useEffect(() => {
    // Load available cards for the selected faction
    let units: any[] = [];
    let orders: any[] = [];
    switch (faction) {
      case Faction.SOVIET: units = getSovietUnits(); orders = createSovietOrders(); break;
      case Faction.GERMANY: units = getGermanUnits(); orders = createGermanOrders(); break;
      case Faction.USA: units = getUSAUnits(); orders = createUSAOrders(); break;
      case Faction.UK: units = getUKUnits(); orders = createUKOrders(); break;
      case Faction.FRANCE: units = getFranceUnits(); orders = createFranceOrders(); break;
    }
    
    // Add IDs to units/orders if they don't have them
    units = units.map(u => ({ ...u, id: `${faction}-unit-${u.name}`, type: CardType.UNIT, category: u.cat, deployCost: u.cost, attack: u.atk, defense: u.def, hp: u.hp, maxHp: u.hp, moveCost: 1, keywords: u.keywords || [] }));
    
    const myAdvancedUnits = ADVANCED_CARDS_DATA.filter(c => c.faction === faction && unlockedIds.includes(c.id)).map(c => ({...c, cat: c.cat, cost: c.cost, atk: c.atk, def: c.def, isAdvanced: true}));
    const myAdvancedOrders = ADVANCED_ORDERS_DATA.filter(c => c.faction === faction && unlockedIds.includes(c.id)).map(c => ({...c, isAdvanced: true}));
    
    setAvailableCards([...units, ...myAdvancedUnits, ...orders, ...myAdvancedOrders, ...ENVIRONMENT_CARDS_DATA.map(e => ({...e, id: `env-${e.name}`, faction}))]);

    // Load saved deck if exists
    if (savedDecks[faction]) {
        const counts = savedDecks[faction];
        const loadedDeck: any[] = [];
        const allPool = [...units, ...myAdvancedUnits, ...orders, ...myAdvancedOrders, ...ENVIRONMENT_CARDS_DATA.map(e => ({...e, id: `env-${e.name}`, faction}))];
        Object.entries(counts).forEach(([templateId, count]) => {
            const cardTemplate = allPool.find(c => c.id === templateId || c.name === templateId);
            if (cardTemplate) {
                for(let i=0; i<count; i++) loadedDeck.push({...cardTemplate});
            }
        });
        setDeck(loadedDeck);
    } else {
        setDeck([]);
    }
  }, [faction, unlockedIds, savedDecks]);

  const addCard = (card: any) => {
    if (deck.length >= 60) {
        alert("卡组最多包含 60 张卡牌！");
        return;
    }
    if (card.isAdvanced) {
        const advCount = deck.filter(c => c.isAdvanced).length;
        if (advCount >= 2) {
            alert("高级卡牌最多只能携带 2 张！");
            return;
        }
    }
    setDeck([...deck, { ...card }]);
  };

  const removeCard = (index: number) => {
    const newDeck = [...deck];
    newDeck.splice(index, 1);
    setDeck(newDeck);
  };

  const saveDeck = () => {
    if (deck.length !== 60) {
        if (!window.confirm(`当前卡组只有 ${deck.length} 张牌（标准为 60 张），确定要保存吗？不足的牌将会在游戏中由系统随机补全。`)) {
            return;
        }
    }
    const counts: Record<string, number> = {};
    deck.forEach(c => {
        const key = c.id || c.name;
        counts[key] = (counts[key] || 0) + 1;
    });
    const newSavedDecks = { ...savedDecks, [faction]: counts };
    setSavedDecks(newSavedDecks);
    localStorage.setItem('customDecks', JSON.stringify(newSavedDecks));
    alert("卡组保存成功！");
  };

  const clearDeck = () => {
    if (window.confirm("确定要清空当前卡组吗？")) {
        setDeck([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[300] flex flex-col p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-amber-500 flex items-center gap-3">
          🛠️ 自定义卡组 (Deck Builder)
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl font-bold">&times;</button>
      </div>

      <div className="flex gap-4 mb-6">
        {Object.values(Faction).map(f => (
          <button 
            key={f} onClick={() => setFaction(f)}
            className={`px-6 py-2 rounded font-bold transition-all ${faction === f ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* 左侧：可用卡牌库 */}
        <div className="flex-1 bg-gray-900 rounded-xl border-2 border-gray-700 flex flex-col overflow-hidden">
            <div className="p-4 bg-gray-800 border-b border-gray-700 font-bold text-lg text-gray-300">
                可用卡牌库 (点击添加)
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-start">
                {availableCards.map((card, i) => (
                    <div key={i} onClick={() => addCard(card)} className="cursor-pointer transform hover:scale-105 transition-transform hover:shadow-[0_0_15px_rgba(251,191,36,0.5)] rounded-lg">
                        <CardComponent card={{...card, hp: card.hp || card.def, maxHp: card.hp || card.def} as any} canPlay={false} onClick={() => {}} />
                    </div>
                ))}
            </div>
        </div>

        {/* 右侧：当前卡组 */}
        <div className="w-1/3 bg-gray-900 rounded-xl border-2 border-gray-700 flex flex-col overflow-hidden">
            <div className="p-4 bg-gray-800 border-b border-gray-700 font-bold text-lg flex justify-between items-center">
                <span className={deck.length === 60 ? 'text-green-400' : 'text-amber-400'}>当前卡组: {deck.length} / 60</span>
                <div className="flex gap-2">
                    <button onClick={clearDeck} className="text-sm bg-red-600 hover:bg-red-500 px-3 py-1 rounded">清空</button>
                    <button onClick={saveDeck} className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded">保存</button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {deck.map((card, i) => (
                    <div key={i} onClick={() => removeCard(i)} className="bg-gray-800 p-2 rounded flex justify-between items-center cursor-pointer hover:bg-red-900/50 group border border-gray-700">
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${card.type === CardType.UNIT ? 'bg-blue-900 text-blue-200' : card.type === CardType.ORDER ? 'bg-purple-900 text-purple-200' : 'bg-green-900 text-green-200'}`}>
                                {card.type === CardType.UNIT ? '单位' : card.type === CardType.ORDER ? '指令' : '环境'}
                            </span>
                            <span className={`font-bold ${card.isAdvanced ? 'text-amber-400' : 'text-gray-200'}`}>{card.name}</span>
                        </div>
                        <span className="text-xs text-gray-500 group-hover:text-red-400 font-bold">移除</span>
                    </div>
                ))}
                {deck.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">卡组为空，请从左侧选择卡牌添加。</div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
