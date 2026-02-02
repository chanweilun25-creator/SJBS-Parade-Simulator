
import React from 'react';
import { EntityType, Entity } from '../types';
import { PIXELS_PER_PACE, ENTITY_SIZE_MAP } from '../constants';

// Helper to determine visuals based on type/label
export const getPersonVisuals = (type: EntityType, label: string = "") => {
    const isOfficer = type === EntityType.OFFICER || type === EntityType.PC;
    const isRSM = type === EntityType.RSM;
    const isColour = type === EntityType.COLOURS;
    const isRO = type === EntityType.REVIEWING_OFFICER;
    const isHost = type === EntityType.HOST;
    // Heuristic for Escort: explicit type check or label
    const isEscort = label.includes('Escort') || label === 'Colours Sgt';
    return { isOfficer, isRSM, isColour, isEscort, isRO, isHost };
};

export const renderPersonSVG = (type: EntityType, label: string = "", customColor?: string) => {
    const { isOfficer, isRSM, isColour, isEscort, isRO, isHost } = getPersonVisuals(type, label);
    
    return (
        <g>
            {/* Drop Shadow */}
            <ellipse cx="0" cy="2" rx="6" ry="6" fill="black" fillOpacity="0.4" filter="blur(1px)" />

            {/* Boots / Shoes */}
            <g transform="translate(0, -3)">
                <ellipse cx="-2.5" cy="0" rx="2" ry="3.5" fill="#111" transform="rotate(-15, -2.5, 0)" />
                <ellipse cx="2.5" cy="0" rx="2" ry="3.5" fill="#111" transform="rotate(15, 2.5, 0)" />
            </g>

            {/* Body */}
            {isRO ? (
                // Tuxedo (Black Suit, White Shirt)
                <g>
                    <rect x="-8" y="-3.5" width="16" height="7" rx="3" fill="#111" stroke="#333" strokeWidth="0.5" />
                    <path d="M -3 -3 L 3 -3 L 0 2 Z" fill="white" />
                    <path d="M -2 -2 L 2 -2 L 0 0 Z" fill="#111" />
                    <circle cx="0" cy="-2" r="0.5" fill="#111" />
                </g>
            ) : isHost ? (
                // Host (Blue Suit, White Shirt)
                <g>
                    <rect x="-8" y="-3.5" width="16" height="7" rx="3" fill="#1e3a8a" stroke="#172554" strokeWidth="0.5" />
                    <path d="M -3 -3 L 3 -3 L 0 2 Z" fill="white" />
                    <path d="M -2 -2 L 2 -2 L 0 0 Z" fill="#1e3a8a" />
                    <circle cx="0" cy="-2" r="0.5" fill="#111" />
                </g>
            ) : (
                // Uniform (White Top)
                <rect x="-8" y="-3.5" width="16" height="7" rx="3" fill="#F9FAFB" stroke="#9CA3AF" strokeWidth="0.5" />
            )}
            
            {/* Epaulettes (Not for RO/Host) */}
            {!isRO && !isHost && (
                <g>
                    <polygon points="-8,-2 -4,-2 -4.5,2 -7.5,2" fill="#111" />
                    <polygon points="8,-2 4,-2 4.5,2 7.5,2" fill="#111" />
                </g>
            )}

            {/* Sashes */}
            {isEscort && <path d="M -6 -3 L 6 3" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />}
            {isColour && <path d="M -6 -3 L 6 3" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />}

            {/* Head */}
            <circle cx="0" cy="0" r="4.5" fill="#FCA5A5" stroke="#F87171" strokeWidth="0.5" />

            {/* Headgear / Hair */}
            {isRO ? (
                 // Brown Hair (Reviewing Officer)
                 <path d="M -4.5 -1 Q -5 -4 0 -4.5 Q 5 -4 4.5 -1 Q 3 2 0 -1 Q -3 2 -4.5 -1 Z" fill="#5D4037" />
            ) : isHost ? (
                 // Host Hair (Lighter/Different Style)
                 <path d="M -4.5 -1 Q -5 -4 0 -4.5 Q 5 -4 4.5 -1 Q 4 1 0 -1 Q -4 1 -4.5 -1 Z" fill="#9ca3af" />
            ) : (isOfficer || isRSM) ? (
                // Peak Cap
                <g>
                    <path d="M -4.5 -1 Q 0 -6 4.5 -1" fill="#000" />
                    <circle cx="0" cy="0" r="4.5" fill="#111" stroke="#333" strokeWidth="0.5" />
                </g>
            ) : (
                // Beret
                <g>
                    <path d="M -4 -2 Q -4 -5 0 -5 Q 5.5 -5 6 0 Q 5.5 4 2 4 Q -2 4 -4 -2 Z" fill="#111" />
                    <circle cx="-2.5" cy="-3.5" r="0.8" fill="#FBBF24" /> 
                </g>
            )}
            
            {/* Held Items */}
            {isRSM && <line x1="-7" y1="-6" x2="-7" y2="5" stroke="#5D4037" strokeWidth="1.5" strokeLinecap="round" />}
            {isColour && (
                 <g transform="translate(4, -4)"> 
                    <circle cx="0" cy="0" r="1.5" fill="#B45309" /> 
                    {/* The Flag - Use custom color if provided */}
                    <path d="M 0 0 Q 8 2 5 10 L 1 10 Z" fill={customColor || "#EF4444"} opacity="0.9" stroke="#7f1d1d" strokeWidth="0.5"/>
                 </g>
            )}
        </g>
    );
};

export const renderFurnitureSVG = (type: EntityType) => {
    if (type === EntityType.SALUTING_BASE) {
         const w = ENTITY_SIZE_MAP[EntityType.SALUTING_BASE] * PIXELS_PER_PACE; // 120
         const h = 4 * PIXELS_PER_PACE; // 80
         // Design: Red carpeted platform with stairs at the "bottom" (positive Y)
         return (
            <g>
                {/* Main Base Shadow */}
                <rect x={-w/2 + 2} y={-h/2 + 2} width={w} height={h} fill="black" opacity="0.3" filter="blur(2px)" />
                {/* Main Platform */}
                <rect x={-w/2} y={-h/2} width={w} height={h} fill="#991b1b" stroke="#f9fafb" strokeWidth={2} />
                {/* Inner Pattern (Carpet texture effect) */}
                <rect x={-w/2 + 4} y={-h/2 + 4} width={w - 8} height={h - 8} fill="none" stroke="#7f1d1d" strokeWidth={1} strokeDasharray="4 2" />
                
                {/* Stairs (Front/Bottom) */}
                <g transform={`translate(0, ${h/2})`}>
                    <rect x={-20} y={0} width={40} height={6} fill="#7f1d1d" stroke="#f9fafb" strokeWidth={1} />
                    <rect x={-20} y={6} width={40} height={6} fill="#991b1b" stroke="#f9fafb" strokeWidth={1} />
                    <rect x={-20} y={12} width={40} height={6} fill="#b91c1c" stroke="#f9fafb" strokeWidth={1} />
                </g>
                
                {/* Text Label built-in */}
                <text y={5} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10} fontWeight="bold" style={{textShadow: '0 1px 2px black'}}>BASE</text>
            </g>
         );
    } 
    
    if (type === EntityType.ROSTRUM) {
         const s = ENTITY_SIZE_MAP[EntityType.ROSTRUM] * PIXELS_PER_PACE; // 30
         return (
             <g>
                 <rect x={-s/2 + 2} y={-s/2 + 2} width={s} height={s} fill="black" opacity="0.3" filter="blur(1px)"/>
                 <rect x={-s/2} y={-s/2} width={s} height={s} rx={2} fill="#78350f" stroke="#451a03" strokeWidth={1} />
                 {/* Top details - slanted top look */}
                 <path d={`M ${-s/2} ${-s/2} L ${s/2} ${-s/2} L ${s/2} ${0} L ${-s/2} ${0} Z`} fill="#92400e" />
                 {/* Script/Mic */}
                 <rect x={-4} y={-6} width={8} height={10} fill="#fef3c7" />
                 <circle cx={6} cy={-6} r={2} fill="#111" />
             </g>
         );
    }

    if (type === EntityType.SPEAKER) {
         // Box with mesh
         return (
            <g>
                 <rect x={-10} y={-10} width={20} height={20} rx={2} fill="#1f2937" stroke="#374151" strokeWidth={1} />
                 <circle cx={0} cy={0} r={7} fill="#374151" stroke="#111" strokeWidth={0.5} />
                 <circle cx={0} cy={0} r={1} fill="#111" />
            </g>
        );
    }

    if (type === EntityType.MIXER) {
         // Audio console
         const w = 40;
         const h = 20;
         return (
             <g>
                 <rect x={-w/2} y={-h/2} width={w} height={h} rx={2} fill="#1f2937" stroke="#4b5563" />
                 {/* Knobs */}
                 <circle cx={-12} cy={-4} r={1.5} fill="#ef4444" />
                 <circle cx={-6} cy={-4} r={1.5} fill="#22c55e" />
                 <circle cx={0} cy={-4} r={1.5} fill="#3b82f6" />
                 {/* Sliders */}
                 <line x1={8} y1={-6} x2={8} y2={6} stroke="#111" strokeWidth={2} />
                 <rect x={6} y={-2} width={4} height={3} fill="#cbd5e1" />
                 <line x1={14} y1={-6} x2={14} y2={6} stroke="#111" strokeWidth={2} />
                 <rect x={12} y={2} width={4} height={3} fill="#cbd5e1" />
             </g>
         );
    }

    if (type === EntityType.AWARD_TABLE) {
        // Brown long table with cloth
        const w = ENTITY_SIZE_MAP[EntityType.AWARD_TABLE] * PIXELS_PER_PACE;
        const h = 1.5 * PIXELS_PER_PACE;
        return (
            <g>
                <rect x={-w/2 + 2} y={-h/2 + 2} width={w} height={h} fill="black" opacity="0.3" filter="blur(2px)"/>
                <rect x={-w/2} y={-h/2} width={w} height={h} fill="#78350f" stroke="#451a03" strokeWidth={1} />
                {/* Tablecloth detail */}
                <path d={`M ${-w/2 + 5} ${-h/2} L ${-w/2 + 5} ${h/2} M ${w/2 - 5} ${-h/2} L ${w/2 - 5} ${h/2}`} stroke="#5d2e0e" strokeWidth={1} />
            </g>
        );
    }

    if (type === EntityType.TROPHY_CUP) {
        return (
            <g>
                <circle r={6} fill="#FCD34D" stroke="#B45309" strokeWidth={1} />
                <path d="M -4 0 Q -7 0 -7 -3 M 4 0 Q 7 0 7 -3" fill="none" stroke="#B45309" strokeWidth={1} />
                <rect x={-3} y={-4} width={6} height={1} fill="#B45309" />
            </g>
        );
    }

    if (type === EntityType.TROPHY_PLAQUE) {
        return (
            <g>
                <rect x={-6} y={-8} width={12} height={16} rx={1} fill="#374151" stroke="#111" />
                <rect x={-4} y={-6} width={8} height={12} fill="#D1D5DB" />
                <line x1={-2} y1={-4} x2={2} y2={-4} stroke="#111" strokeWidth={0.5} />
                <line x1={-2} y1={-2} x2={2} y2={-2} stroke="#111" strokeWidth={0.5} />
            </g>
        );
    }
    
    if (type === EntityType.TROPHY_SHIELD) {
        return (
            <g>
                <path d="M -6 -7 L 6 -7 L 6 -2 Q 0 8 -6 -2 Z" fill="#78350f" stroke="#451a03" />
                <path d="M -4 -5 L 4 -5 L 4 -2 Q 0 6 -4 -2 Z" fill="#FCD34D" />
            </g>
        );
    }

    if (type === EntityType.MARKER) {
         return (
             <g>
                 <circle r={6} fill="none" stroke="#fff" strokeWidth={2} />
                 <line x1={-6} y1={-6} x2={6} y2={6} stroke="#fff" />
                 <line x1={-6} y1={6} x2={6} y2={-6} stroke="#fff" />
             </g>
         );
    }

    // Default fallback
    return <circle r={5} fill="red" />;
};

export const renderEntityVisual = (type: EntityType, label: string = "", customColor?: string) => {
    // Furniture check
    if ([EntityType.SALUTING_BASE, EntityType.ROSTRUM, EntityType.SPEAKER, EntityType.MIXER, EntityType.MARKER, EntityType.AWARD_TABLE, EntityType.TROPHY_CUP, EntityType.TROPHY_PLAQUE, EntityType.TROPHY_SHIELD].includes(type)) {
        return renderFurnitureSVG(type);
    }
    // People check
    return renderPersonSVG(type, label, customColor);
};
