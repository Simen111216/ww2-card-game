import React from 'react';
import { useTranslation } from 'react-i18next';
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

const keywordDescriptions: Record<string, string> = {
  '闪击': '部署当回合即可攻击',
  '守护': '敌方必须先攻击此单位',
  '伏击': '受击前先造成反击伤害',
  '重甲': '受到的所有伤害 -1',
  '防空': '对空军造成额外伤害'
};

export const CardComponent: React.FC<CardProps> = ({ card, onClick, isSelected, canPlay = true }) => {
  const { t } = useTranslation();
  const isUnit = card.type === CardType.UNIT;
  const unitCard = isUnit ? (card as UnitCard) : null;
  const bgColor = factionColors[card.faction] || 'bg-gray-600';

  return (
    <div
      id={`card-${card.id}`}
      onClick={canPlay ? onClick : undefined}
      className={`
        relative w-32 h-48 rounded-lg shadow-lg overflow-hidden border-[3px] transition-transform duration-200
        ${bgColor} bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-blend-multiply
        ${canPlay ? 'cursor-pointer hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(0,0,0,0.8)]' : 'opacity-75 cursor-not-allowed'}
        ${isSelected ? 'ring-4 ring-yellow-400 -translate-y-2' : 'border-gray-800'}
        flex flex-col text-white select-none
      `}
    >
      {/* 部署消耗 - 左上角 */}
      <div className="absolute top-1 left-1 bg-yellow-500 text-black font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-yellow-700 z-10 shadow-sm text-sm">
        {card.deployCost}
      </div>

      {/* 卡牌类型标识 - 右上角 */}
      <div className="absolute top-1 right-1 text-[10px] font-bold uppercase opacity-80 z-10 flex gap-1 flex-col items-end">
        <div className="flex gap-1">
          {card.isAdvanced && (
             <span className="bg-amber-600 text-white px-1 rounded shadow-lg border border-amber-400">{t('card.advanced')}</span>
          )}
          <span className="bg-black/50 px-1 rounded">
            {card.type === CardType.UNIT ? (unitCard?.category ? t(`card.category.${unitCard.category}`) : t('card.unit')) : t('card.order')}
          </span>
        </div>
        
        {/* 状态图标 */}
        {unitCard && (
          <div className="flex gap-1 mt-0.5">
            {unitCard.hasShield && <span className="bg-cyan-500 text-white px-1 rounded text-[10px] shadow-sm animate-pulse" title="护盾">🛡️</span>}
            {unitCard.burnStacks && unitCard.burnStacks > 0 ? <span className="bg-orange-600 text-white px-1 rounded text-[10px] shadow-sm animate-bounce" title={`灼烧 x${unitCard.burnStacks}`}>🔥{unitCard.burnStacks}</span> : null}
            {unitCard.keywords?.includes('守护' as any) && <span className="bg-gray-400 text-black px-1 rounded text-[10px] shadow-sm" title="守护">🔰</span>}
          </div>
        )}
      </div>

      {/* 图片/插图占位 */}
      <div className="w-full h-16 bg-gray-900/80 mt-3 border-b border-t border-gray-600 flex items-center justify-center shadow-inner relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-50"></div>
        <span className="text-gray-500 text-[10px] italic z-10">{t('card.imagePlaceholder')}</span>
      </div>

      {/* 卡牌名称 */}
      <div className="px-1 py-1 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-center font-bold text-xs border-b-2 border-gray-900 leading-tight shadow-md text-amber-50">
        {card.name}
      </div>
      
      {/* 军衔展示区 (仅单位卡且在场上时可能有 rank) */}
      {unitCard && (unitCard.rank || 0) > 0 && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 flex gap-0.5 z-10 drop-shadow-md">
          {Array.from({ length: unitCard.rank! }).map((_, i) => (
             <span key={i} className="text-yellow-400 text-[10px] leading-none">★</span>
          ))}
        </div>
      )}

      {/* 卡牌描述 / 词条解析 */}
      <div className="p-1 text-[8px] flex-grow bg-white/10 text-gray-200 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent flex flex-col justify-start gap-0.5 leading-tight">
        {isUnit ? (
          <>
            {/* 专属词条（如果有） */}
            {unitCard.exclusiveName && (
              <div className="border-b border-gray-600/50 pb-0.5 mb-0.5">
                <span className="font-bold text-yellow-400">◆ {unitCard.exclusiveName}</span>
                <p className="text-gray-300 mt-0.5">{unitCard.exclusiveDesc}</p>
              </div>
            )}
            
            {/* 基础词条 */}
            {unitCard.keywords.length > 0 ? (
              <div className="flex flex-col gap-0.5 text-left w-full">
                {unitCard.keywords.map((kw, i) => (
                  <div key={i} className="flex">
                    <span className="font-bold text-purple-300 shrink-0">【{t(`card.keywords.${kw}`)}】</span>
                    <span className="text-gray-400 ml-0.5">{t(`card.keywordDesc.${kw}`)}</span>
                  </div>
                ))}
              </div>
            ) : (
              !unitCard.exclusiveName && <span className="text-gray-500 italic text-center w-full mt-1">{t('card.noSpecialTrait')}</span>
            )}
          </>
        ) : (
          <span className="text-center w-full mt-1">{card.description}</span>
        )}
      </div>

      {/* 属性栏 (仅单位卡显示) */}
      {unitCard && (
        <div className="w-full h-5 shrink-0 bg-black/80 flex justify-between items-center px-1 text-[10px] font-bold border-t-2 border-gray-800">
          <div className="text-red-400 flex items-center" title={t('card.attack')}>
            ⚔ {unitCard.attack}
          </div>
          <div className="text-blue-400 flex items-center" title={t('card.defense')}>
            🛡 {unitCard.defense}
          </div>
          <div className="text-green-400 flex items-center" title={t('card.hp')}>
            ❤ {unitCard.hp}
          </div>
        </div>
      )}
    </div>
  );
};
