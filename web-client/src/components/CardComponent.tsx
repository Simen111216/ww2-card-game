import React from 'react';
import { CardType, Faction } from '../engine/types';
import type { BaseCard, UnitCard } from '../engine/types';

interface CardProps {
  card: BaseCard;
  onClick?: () => void;
  isSelected?: boolean;
  canPlay?: boolean;
}

const factionColors: Record<Faction, string> = {
  [Faction.SOVIET]: 'bg-red-800 border-red-900',
  [Faction.USA]: 'bg-blue-700 border-blue-900',
  [Faction.UK]: 'bg-green-800 border-green-900',
  [Faction.FRANCE]: 'bg-blue-400 border-blue-600',
  [Faction.GERMANY]: 'bg-gray-700 border-gray-900',
};

export const CardComponent: React.FC<CardProps> = ({ card, onClick, isSelected, canPlay = true }) => {
  const isUnit = card.type === CardType.UNIT;
  const unitCard = isUnit ? (card as UnitCard) : null;
  const bgColor = factionColors[card.faction] || 'bg-gray-600';

  return (
    <div
      id={`card-${card.id}`}
      onClick={canPlay ? onClick : undefined}
      className={`
        relative w-40 h-56 rounded-lg shadow-lg overflow-hidden border-4 transition-transform duration-200
        ${bgColor}
        ${canPlay ? 'cursor-pointer hover:-translate-y-4 hover:shadow-xl' : 'opacity-75 cursor-not-allowed'}
        ${isSelected ? 'ring-4 ring-yellow-400 -translate-y-4' : 'border-gray-800'}
        flex flex-col text-white select-none
      `}
    >
      {/* 部署消耗 - 左上角 */}
      <div className="absolute top-1 left-1 bg-yellow-500 text-black font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-yellow-700 z-10 shadow-sm">
        {card.deployCost}
      </div>

      {/* 卡牌类型标识 - 右上角 */}
      <div className="absolute top-2 right-2 text-xs font-bold uppercase opacity-80 z-10 flex gap-1">
        {card.isAdvanced && (
           <span className="bg-amber-600 text-white px-1 rounded shadow-lg border border-amber-400">高级</span>
        )}
        <span className="bg-black/50 px-1 rounded">
          {card.type === CardType.UNIT ? (unitCard?.category || '单位') : '指令'}
        </span>
      </div>

      {/* 图片/插图占位 */}
      <div className="w-full h-24 bg-gray-900/50 mt-4 border-b-2 border-t-2 border-gray-800 flex items-center justify-center">
        <span className="text-gray-400 text-sm italic">Image Placeholder</span>
      </div>

      {/* 卡牌名称 */}
      <div className="px-2 py-1 bg-black/60 text-center font-bold text-sm border-b-2 border-gray-800">
        {card.name}
      </div>
      
      {/* 军衔展示区 (仅单位卡且在场上时可能有 rank) */}
      {unitCard && (unitCard.rank || 0) > 0 && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex gap-0.5 z-10 drop-shadow-md">
          {Array.from({ length: unitCard.rank! }).map((_, i) => (
             <span key={i} className="text-yellow-400 text-lg leading-none">★</span>
          ))}
        </div>
      )}

      {/* 词条展示区 (仅单位卡) */}
      {unitCard && unitCard.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 py-1 bg-black/40 justify-center">
          {unitCard.keywords.map((kw, i) => (
            <span key={i} className="text-[10px] bg-purple-900/80 text-purple-200 px-1.5 rounded border border-purple-700 font-bold shadow">
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* 卡牌描述 */}
      <div className="p-2 text-xs flex-grow bg-white/10 text-gray-200 text-center overflow-hidden flex flex-col justify-center">
        {card.description}
      </div>

      {/* 属性栏 (仅单位卡显示) */}
      {unitCard && (
        <div className="absolute bottom-0 left-0 w-full h-8 bg-black/80 flex justify-between items-center px-2 text-sm font-bold border-t-2 border-gray-800">
          <div className="text-red-400 flex items-center" title="攻击力">
            ⚔ {unitCard.attack}
          </div>
          <div className="text-blue-400 flex items-center" title="防御力">
            🛡 {unitCard.defense}
          </div>
          <div className="text-green-400 flex items-center" title="血量">
            ❤ {unitCard.hp}
          </div>
        </div>
      )}
    </div>
  );
};
