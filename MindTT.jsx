import React, { useState, useEffect, useRef } from 'react';

// ── 경험치 시스템 상수 ──
const XP_BASE = 2;
const XP_SCALE = 1.8;
const BONUS_PER_LV = 0.03;
const MAX_BONUS = 0.25;
const MAX_LV = 10;

const xpRequired = (lv) => {
  if (lv <= 1) return XP_BASE;
  let v = XP_BASE;
  for (let i = 1; i < lv; i++) v = Math.ceil(v * XP_SCALE);
  return v;
};
const lvBonus = (lv) => Math.min(MAX_BONUS, (lv - 1) * BONUS_PER_LV);

const XP_SKILLS = [
  'DRIVE','COUNTER_DRIVE','FLICK','CHIQUITA','LOOP','POWER_DRIVE',
  'BH_DRIVE','SMASH','BLOCK','SHORT_BLOCK','LOB','CUT','STOP','PUSH',
  'SERVE_SHORT_BACK','SERVE_LONG_FAST','SERVE_SHORT_TOP','SERVE_SHORT_SIDE',
  'SERVE_LONG_BACK','SERVE_LONG_SIDE','SERVE_SHORT_SIDE_BACK','SERVE_SHORT_SIDE_TOP',
  'SERVE_KNUCKLE','SERVE_DOUBLE_BOUNCE',
];
const SKILL_NAMES = {
  DRIVE:'드라이브', COUNTER_DRIVE:'카운터', FLICK:'플릭',
  CHIQUITA:'치키타', LOOP:'루프', POWER_DRIVE:'파워드라이브',
  BH_DRIVE:'BH드라이브', SMASH:'스매시', BLOCK:'블록',
  SHORT_BLOCK:'쇼트', LOB:'로빙', CUT:'맞커트', STOP:'스톱', PUSH:'보스커트',
  SERVE_SHORT_BACK:'짧은하회전', SERVE_LONG_FAST:'빠른롱서브',
  SERVE_SHORT_TOP:'짧은상회전', SERVE_SHORT_SIDE:'짧은횡회전',
  SERVE_LONG_BACK:'긴하회전', SERVE_LONG_SIDE:'긴횡회전',
  SERVE_SHORT_SIDE_BACK:'횡하회전', SERVE_SHORT_SIDE_TOP:'횡상회전',
  SERVE_KNUCKLE:'너클서브', SERVE_DOUBLE_BOUNCE:'더블바운드',
};
const initSkillData = () => {
  const d = {};
  XP_SKILLS.forEach(k => { d[k] = { lv: 1, uses: 0 }; });
  return d;
};

// ── 스핀 RPM 정의 ──
// 프로 기준에서 40% 낮춘 값
const SPIN_RPM = {
  BACKSPIN:      -2700,  // 프로 ~4,500 × 0.6
  TOPSPIN:        2300,  // 프로 ~3,800 × 0.6
  LOOP_SPIN:      3600,  // 프로 ~6,000 × 0.6
  POWER_SPIN:     4800,  // 프로 ~8,000 × 0.6
  SIDESPIN:       2100,  // 프로 ~3,500 × 0.6
  SIDESPIN_BACK: -2400,  // 프로 ~4,000 × 0.6
  SIDESPIN_TOP:   2100,  // 프로 ~3,500 × 0.6
  FAST_TOP:       3000,  // 프로 ~5,000 × 0.6
  LONG_BACK:     -3000,  // 프로 ~5,000 × 0.6
  LONG_SIDE:      2400,  // 프로 ~4,000 × 0.6
  DOUBLE_BOUNCE: -1500,  // 프로 ~2,500 × 0.6
  KNUCKLE:           0,
  LOB_SPIN:       1500,  // 프로 ~2,500 × 0.6
  FLOAT:           600,  // 프로 ~1,000 × 0.6
  BLOCK_RETURN:   1200,  // 프로 ~2,000 × 0.6
};
const MAX_RPM = 5500;   // 프로 최대 ~9,000 × 0.6

// RPM이 각 기술 성공률에 미치는 영향
const getRpmModifier = (action, spin) => {
  if (!spin) return 0;
  const rpm = SPIN_RPM[spin] ?? 0;
  const n = Math.abs(rpm) / MAX_RPM; // 0~1 정규화
  const isBack = rpm < -2000;
  const isTop  = rpm >  2000;
  const modifiers = {
    DRIVE:         isBack ? -n * 0.18 : 0,                       // 하회전에 드라이브 어려움
    LOOP:          isBack ?  n * 0.12 : isTop ? -n * 0.08 : 0,  // 하회전엔 루프 유리
    COUNTER_DRIVE: isTop  ? -n * 0.12 : 0,                       // 강한 상회전에 카운터 어려움
    BLOCK:         isTop  ? -n * 0.14 : 0,                       // 상회전 블록 어려움
    CUT:           isBack ?  n * 0.10 : isTop ? -n * 0.12 : 0,  // 하회전엔 커트 유리
    PUSH:          isBack ?  n * 0.08 : isTop ? -n * 0.10 : 0,
    STOP:          isBack ?  n * 0.06 : isTop ? -n * 0.10 : 0,
    FLICK:         isBack ? -n * 0.08 : 0,                       // 하회전 플릭 위험
    CHIQUITA:      isBack ? -n * 0.06 : 0,
    BH_DRIVE:      isBack ? -n * 0.12 : 0,
    SHORT_BLOCK:   isTop  ? -n * 0.08 : 0,
    SMASH:         isTop  ? -n * 0.04 : 0,
    POWER_DRIVE:   isBack ? -n * 0.10 : 0,
  };
  return modifiers[action] ?? 0;
};

// 서브 카테고리 정의
const SERVES_SHORT = [
  { label:'짧은 하회전',   action:'SERVE_SHORT_BACK',      color:'#1e40af', sub:'안전/정석' },
  { label:'짧은 상회전',   action:'SERVE_SHORT_TOP',       color:'#78350f', sub:'커트 함정' },
  { label:'짧은 횡회전',   action:'SERVE_SHORT_SIDE',      color:'#4c1d95', sub:'방향 혼란' },
  { label:'짧은 횡하회전', action:'SERVE_SHORT_SIDE_BACK', color:'#5b21b6', sub:'복합 회전' },
  { label:'짧은 횡상회전', action:'SERVE_SHORT_SIDE_TOP',  color:'#6d28d9', sub:'복합 속임수' },
  { label:'너클 (무회전)', action:'SERVE_KNUCKLE',          color:'#374151', sub:'불규칙 바운드' },
  { label:'더블 바운드',   action:'SERVE_DOUBLE_BOUNCE',   color:'#065f46', sub:'매우 짧게' },
];
const SERVES_LONG = [
  { label:'긴 빠른 상회전', action:'SERVE_LONG_FAST', color:'#7f1d1d', sub:'기습 에이스' },
  { label:'긴 하회전',      action:'SERVE_LONG_BACK', color:'#1e3a5f', sub:'낮고 깊게' },
  { label:'긴 횡회전',      action:'SERVE_LONG_SIDE', color:'#312e81', sub:'깊은 사이드' },
];

export default function TableTennisChess() {
  const [gameState, setGameState]         = useState('START');
  const [score, setScore]                 = useState({ player: 0, opponent: 0 });
  const [turn, setTurn]                   = useState('PLAYER');
  const [server, setServer]               = useState('PLAYER');
  const [ball, setBall]                   = useState(null);
  const [logs, setLogs]                   = useState([]);
  const [skills, setSkills]               = useState(initSkillData());
  const [levelUpFlash, setLevelUpFlash]   = useState(null);
  const [serveTab, setServeTab]           = useState('SHORT'); // 'SHORT' | 'LONG'
  const [pendingAction, setPendingAction] = useState(null);
  const [moveHistory, setMoveHistory]         = useState([]);
  const [opponentHistory, setOpponentHistory] = useState([]);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg, type = 'system') => setLogs(p => [...p, { text: msg, type }]);
  const pushHistory = (label, key) => {
    const pct = key ? Math.round(lvBonus(skills[key]?.lv ?? 1) * 100) : 0;
    setMoveHistory(p => [{ label, pct }, ...p].slice(0, 8));
  };
  const pushOpponentHistory = (label) => setOpponentHistory(p => [{ label }, ...p].slice(0, 8));

  // 상대 턴 전환 시 카운터 세부 선택 초기화
  useEffect(() => { if (turn === 'OPPONENT') setPendingAction(null); }, [turn]);

  // ── 경험치 처리 ──
  const useSkill = (key) => {
    if (!XP_SKILLS.includes(key)) return;
    setSkills(prev => {
      const s = prev[key];
      const newUses = s.uses + 1;
      const needed = xpRequired(s.lv);
      if (s.lv < MAX_LV && newUses >= needed) {
        const newLv = s.lv + 1;
        const pct = Math.round(lvBonus(newLv) * 100);
        setTimeout(() => {
          addLog(`🆙 [${SKILL_NAMES[key]}] Lv${s.lv}→Lv${newLv}! 성공률 +${pct}%`, 'levelup');
          setLevelUpFlash({ skill: key, newLv });
          setTimeout(() => setLevelUpFlash(null), 2000);
        }, 50);
        return { ...prev, [key]: { lv: newLv, uses: 0 } };
      }
      return { ...prev, [key]: { ...s, uses: newUses } };
    });
  };

  const applyBonus = (base, key) => {
    const lv = lvBonus(skills[key]?.lv ?? 1);
    const rpm = getRpmModifier(key, ball?.spin);
    return Math.min(0.97, Math.max(0.05, base + lv + rpm));
  };

  const checkServerChange = (total) => {
    if (total > 0 && total % 2 === 0) {
      const ns = server === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
      setServer(ns);
      addLog(`🏓 서브권 교대! 현재: ${ns === 'PLAYER' ? '나' : '상대방'}`, 'system');
      return ns;
    }
    return server;
  };

  const winPoint = (winner) => {
    const ns = { ...score, [winner]: score[winner] + 1 };
    setScore(ns);
    setBall(null);
    addLog(`🎉 ${winner === 'player' ? '득점!' : '실점...'} (${ns.player}:${ns.opponent})`, 'system');
    if (ns.player >= 5) { addLog('🏆 게임 승리!', 'system'); setGameState('GAME_OVER'); return; }
    if (ns.opponent >= 5) { addLog('💀 게임 패배!', 'system'); setGameState('GAME_OVER'); return; }
    setTurn(checkServerChange(ns.player + ns.opponent));
  };

  const startGame = () => {
    setScore({ player: 0, opponent: 0 });
    setServer('PLAYER'); setTurn('PLAYER'); setBall(null);
    setMoveHistory([]);
    setOpponentHistory([]);
    setGameState('PLAYING');
    setServeTab('SHORT');
    setLogs([{ text: '🏁 게임 시작! 스킬을 반복 사용해 레벨업하세요.', type: 'system' }]);
  };

  const rc = () => (Math.random() > 0.5 ? 0 : 1);

  // ── 방향 보정: 크로스=자연스러운(+5%), 스트레이트=전환 패널티 ──
  const calcChance = (base, fromCol, fromRow, toCol) => {
    if (fromCol !== toCol) return Math.min(0.97, base + 0.05);
    return Math.max(0.15, base - (fromRow === 3 ? 0.20 : 0.10));
  };

  const executeAttack = (action, baseChance, label) => {
    if (!ball) return;
    const toCol = rc();
    const fromCol = ball.col, fromRow = ball.row;
    const isCross = fromCol !== toCol;
    const chance = calcChance(baseChance, fromCol, fromRow, toCol);
    const pct = Math.round(chance * 100);
    const dirLabel = isCross
      ? (fromRow === 3 ? `깊은크로스 (${pct}%)` : `크로스 (${pct}%)`)
      : `스트레이트 (${pct}%)`;
    addLog(`나: ${label} → ${dirLabel}`, 'player');
    useSkill(action);
    if (Math.random() < chance) {
      addLog('🎲 성공!', 'player');
      const outSpin = action === 'LOOP' ? 'LOOP_SPIN' : action === 'POWER_DRIVE' ? 'POWER_SPIN' : 'TOPSPIN';
      setBall({ row: 0, col: toCol, spin: outSpin, fromRow, fromCol });
      setTurn('OPPONENT');
    } else {
      const fails = {
        DRIVE:'🎲 네트에 걸립니다.', COUNTER_DRIVE:'🎲 타이밍 실패. 아웃.',
        FLICK:'🎲 플릭 미스!', CHIQUITA:'🎲 치키타 미스!',
        LOOP:'🎲 루프 네트!', POWER_DRIVE:'🎲 파워드라이브 아웃!',
        BH_DRIVE:'🎲 백핸드 미스!', SMASH:'🎲 홈런!',
      };
      addLog(fails[action] || '🎲 공격 실패.', 'system');
      winPoint('opponent');
    }
  };

  // ── 플레이어 액션 ──
  const handlePlayerAction = (action) => {
    if (turn !== 'PLAYER') return;

    // 카운터 세부 선택
    if (action === 'COUNTER_DRIVE') { setPendingAction('COUNTER_DRIVE'); return; }
    if (action === 'CANCEL') { setPendingAction(null); return; }
    if (action === 'COUNTER_STABLE') {
      setPendingAction(null);
      pushHistory('안정적 카운터', 'COUNTER_DRIVE');
      executeAttack('COUNTER_DRIVE', applyBonus(0.68, 'COUNTER_DRIVE'), '🌀 안정적 카운터');
      return;
    }
    if (action === 'COUNTER_POWER') {
      setPendingAction(null);
      pushHistory('파워 카운터', 'COUNTER_DRIVE');
      executeAttack('POWER_DRIVE', applyBonus(0.42, 'POWER_DRIVE'), '💥 파워 카운터');
      return;
    }

    const col = rc();

    const ATTACK_DEFS = {
      DRIVE:         { base: ball?.spin === 'BLOCK_RETURN' ? 0.85 : 0.70, label: ball?.spin === 'BLOCK_RETURN' ? '🔥 드라이브(뜬공)' : '🔥 드라이브' },
      COUNTER_DRIVE: { base: 0.55, label: '🌀 카운터 드라이브' },
      FLICK:         { base: 0.60, label: '⚡ 플릭' },
      CHIQUITA:      { base: 0.35, label: '🎯 치키타' },
      LOOP:          { base: 0.65, label: '🌀 루프' },
      POWER_DRIVE:   { base: 0.60, label: '💥 파워 드라이브' },
      BH_DRIVE:      { base: 0.65, label: '🔵 BH 드라이브' },
      SMASH:         { base: ball?.spin === 'LOB_SPIN' ? 0.92 : ball?.spin === 'BLOCK_RETURN' ? 0.92 : 0.85, label: '💥 스매시' },
    };
    if (ATTACK_DEFS[action]) { pushHistory(ATTACK_DEFS[action].label, action); executeAttack(action, applyBonus(ATTACK_DEFS[action].base, action), ATTACK_DEFS[action].label); return; }

    switch (action) {
      case 'SERVE_SHORT_BACK':      useSkill(action); pushHistory('짧은 하회전', action); addLog('나: [짧은 하회전] — 안전한 오프닝', 'player'); setBall({ row: 1, col, spin: 'BACKSPIN' }); setTurn('OPPONENT'); break;
      case 'SERVE_LONG_FAST':       useSkill(action); pushHistory('긴 빠른 상회전', action); addLog('나: [긴 빠른 상회전] — 기습!', 'player'); setBall({ row: 0, col, spin: 'FAST_TOP' }); setTurn('OPPONENT'); break;
      case 'SERVE_SHORT_TOP':       useSkill(action); pushHistory('짧은 상회전', action); addLog('나: [짧은 상회전] — 커트 함정', 'player'); setBall({ row: 1, col, spin: 'TOPSPIN' }); setTurn('OPPONENT'); break;
      case 'SERVE_SHORT_SIDE':      useSkill(action); pushHistory('짧은 횡회전', action); addLog('나: [짧은 횡회전] — 방향 혼란', 'player'); setBall({ row: 1, col, spin: 'SIDESPIN' }); setTurn('OPPONENT'); break;
      case 'SERVE_LONG_BACK':       useSkill(action); pushHistory('긴 하회전', action); addLog('나: [긴 하회전] — 깊고 낮게', 'player'); setBall({ row: 0, col, spin: 'LONG_BACK' }); setTurn('OPPONENT'); break;
      case 'SERVE_LONG_SIDE':       useSkill(action); pushHistory('긴 횡회전', action); addLog('나: [긴 횡회전] — 깊은 사이드스핀', 'player'); setBall({ row: 0, col, spin: 'LONG_SIDE' }); setTurn('OPPONENT'); break;
      case 'SERVE_SHORT_SIDE_BACK': useSkill(action); pushHistory('횡하회전', action); addLog('나: [짧은 횡하회전] — 복합 회전', 'player'); setBall({ row: 1, col, spin: 'SIDESPIN_BACK' }); setTurn('OPPONENT'); break;
      case 'SERVE_SHORT_SIDE_TOP':  useSkill(action); pushHistory('횡상회전', action); addLog('나: [짧은 횡상회전] — 복합 속임수', 'player'); setBall({ row: 1, col, spin: 'SIDESPIN_TOP' }); setTurn('OPPONENT'); break;
      case 'SERVE_KNUCKLE':         useSkill(action); pushHistory('너클', action); addLog('나: [너클] — 무회전 불규칙!', 'player'); setBall({ row: 1, col, spin: 'KNUCKLE' }); setTurn('OPPONENT'); break;
      case 'SERVE_DOUBLE_BOUNCE':   useSkill(action); pushHistory('더블 바운드', action); addLog('나: [더블 바운드] — 두 번 튕김!', 'player'); setBall({ row: 1, col, spin: 'DOUBLE_BOUNCE' }); setTurn('OPPONENT'); break;
      case 'STOP':        useSkill(action); pushHistory('스톱', action); addLog('나: [스톱] 네트 앞에 놓습니다.', 'player'); setBall({ row: 1, col, spin: 'BACKSPIN' }); setTurn('OPPONENT'); break;
      case 'PUSH': {
        useSkill(action); pushHistory('보스커트', action);
        const isSide = ball?.spin === 'SIDESPIN' || ball?.spin === 'SIDESPIN_BACK';
        if (isSide) {
          addLog('나: [보스커트] — 횡회전에 밀려 방향이 꺾입니다!', 'player');
          if (Math.random() < 0.85) { addLog('공이 옆으로 튕겨 아웃!', 'system'); winPoint('opponent'); }
          else { addLog('간신히 넘어갔지만 공이 붕 뜹니다!', 'system'); setBall({ row: 0, col, spin: 'BLOCK_RETURN' }); setTurn('OPPONENT'); }
        } else {
          addLog('나: [보스커트] 깊숙이 찌릅니다.', 'player'); setBall({ row: 0, col, spin: 'BACKSPIN' }); setTurn('OPPONENT');
        }
        break;
      }
      case 'CUT': {
        useSkill(action); pushHistory('맞커트', action);
        const isSideCut = ball?.spin === 'SIDESPIN' || ball?.spin === 'SIDESPIN_BACK';
        if (isSideCut) {
          addLog('나: [맞커트] — 횡회전에 각도를 잃습니다!', 'player');
          if (Math.random() < 0.85) { addLog('공이 옆으로 튕겨 아웃!', 'system'); winPoint('opponent'); }
          else { addLog('간신히 넘어갔지만 공이 붕 뜹니다!', 'system'); setBall({ row: 0, col, spin: 'BLOCK_RETURN' }); setTurn('OPPONENT'); }
        } else {
          addLog('나: [맞커트] 길게 깎아 보냅니다.', 'player'); setBall({ row: 0, col, spin: 'BACKSPIN' }); setTurn('OPPONENT');
        }
        break;
      }
      case 'SHORT_BLOCK': useSkill(action); pushHistory('쇼트', action); addLog('나: [쇼트] 짧게 밀어냅니다.', 'player'); setBall({ row: 1, col, spin: 'BACKSPIN' }); setTurn('OPPONENT'); break;
      case 'LOB': {
        useSkill(action); pushHistory('로빙', action);
        // 로빙은 의도적으로 상대에게 기회를 주는 수비 기술
        // 레벨이 높으면 높게 올려 스매시 각도를 줄이는 효과 (AI 스매시 성공률 하락)
        const lobLv = skills['LOB']?.lv ?? 1;
        const aiSmashPenalty = lvBonus(lobLv); // 레벨업할수록 AI 스매시 어렵게
        addLog(`나: 🪂 [로빙] 높이 올립니다! (AI 스매시 성공률 -${Math.round(aiSmashPenalty*100)}%)`, 'player');
        setBall({ row: 0, col, spin: 'LOB_SPIN', lobPenalty: aiSmashPenalty });
        setTurn('OPPONENT');
        break;
      }
      case 'BLOCK': {
        useSkill(action); pushHistory('블록', action);
        const hard = ball?.spin === 'FAST_TOP' || ball?.spin === 'POWER_SPIN';
        const base = hard ? 0.35 : 0.62;
        const chance = applyBonus(base, 'BLOCK');
        addLog(`나: 🛡️ [블록] — ${hard ? '파워에 밀릴 수 있습니다!' : '공이 뜨게 넘깁니다.'}`, 'player');
        if (Math.random() < chance) {
          addLog('🎲 블록 성공 — 공이 떠서 넘어갑니다.', 'player');
          setBall({ row: Math.random() > 0.5 ? 1 : 0, col, spin: 'BLOCK_RETURN' });
          setTurn('OPPONENT');
        } else { addLog('🎲 방어 실패!', 'system'); winPoint('opponent'); }
        break;
      }
      default: break;
    }
  };

  // ── AI 턴 ──
  useEffect(() => {
    if (turn === 'OPPONENT' && gameState === 'PLAYING') {
      const t = setTimeout(executeOpponentTurn, 1500);
      return () => clearTimeout(t);
    }
  }, [turn, gameState, ball]);

  const executeOpponentTurn = () => {
    const col = rc();

    // 서브
    if (!ball) {
      const r = Math.random();
      if      (r < 0.17) { pushOpponentHistory('짧은 하회전'); addLog('상대: [짧은 하회전 서브]', 'opponent');            setBall({ row: 2, col, spin: 'BACKSPIN' }); }
      else if (r < 0.28) { pushOpponentHistory('긴 빠른 상회전'); addLog('상대: 기습! [긴 빠른 상회전 서브]!', 'opponent');  setBall({ row: 3, col, spin: 'FAST_TOP' }); }
      else if (r < 0.38) { pushOpponentHistory('짧은 상회전'); addLog('상대: [짧은 상회전 서브] 속임수', 'opponent');     setBall({ row: 2, col, spin: 'TOPSPIN' }); }
      else if (r < 0.46) { pushOpponentHistory('짧은 횡회전'); addLog('상대: [짧은 횡회전 서브]!', 'opponent');            setBall({ row: 2, col, spin: 'SIDESPIN' }); }
      else if (r < 0.54) { pushOpponentHistory('긴 하회전'); addLog('상대: [긴 하회전 서브] 낮고 깊게!', 'opponent');   setBall({ row: 3, col, spin: 'LONG_BACK' }); }
      else if (r < 0.61) { pushOpponentHistory('긴 횡회전'); addLog('상대: [긴 횡회전 서브]!', 'opponent');              setBall({ row: 3, col, spin: 'LONG_SIDE' }); }
      else if (r < 0.69) { pushOpponentHistory('횡하회전'); addLog('상대: [짧은 횡하회전 서브]!', 'opponent');          setBall({ row: 2, col, spin: 'SIDESPIN_BACK' }); }
      else if (r < 0.76) { pushOpponentHistory('횡상회전'); addLog('상대: [짧은 횡상회전 서브]!', 'opponent');          setBall({ row: 2, col, spin: 'SIDESPIN_TOP' }); }
      else if (r < 0.83) { pushOpponentHistory('너클'); addLog('상대: ⚪ [너클 서브]!', 'opponent');               setBall({ row: 2, col, spin: 'KNUCKLE' }); }
      else               { pushOpponentHistory('더블 바운드'); addLog('상대: 🏀 [더블 바운드 서브]!', 'opponent');         setBall({ row: 2, col, spin: 'DOUBLE_BOUNCE' }); }
      setTurn('PLAYER'); return;
    }

    const { row, spin } = ball;
    const aiToCol = rc();
    const aiFromCol = ball.col;
    const dirLabel = aiFromCol !== aiToCol ? (row <= 1 ? '깊은 크로스' : '크로스') : '스트레이트';

    // ── 로빙 → AI 스매시 (레벨에 따라 성공률 조정) ──
    if (spin === 'LOB_SPIN') {
      const penalty = ball.lobPenalty ?? 0;
      const smashChance = Math.max(0.50, 0.90 - penalty);
      addLog(`상대: 로빙! 💥 스매시! (성공률 ${Math.round(smashChance*100)}%)`, 'opponent');
      if (Math.random() < smashChance) {
        pushOpponentHistory('스매시');
        setBall({ row: 3, col: aiToCol, spin: 'POWER_SPIN', fromRow: row, fromCol: aiFromCol });
        setTurn('PLAYER');
      } else { addLog('상대: 스매시 미스!', 'system'); winPoint('player'); }
      return;
    }

    // ── 뜬공(블록리턴) ──
    if (spin === 'BLOCK_RETURN') {
      addLog('상대: 뜬 공! 🔥 드라이브!', 'opponent');
      const chance = calcChance(0.88, aiFromCol, row, aiToCol);
      if (Math.random() < chance) { pushOpponentHistory('드라이브'); setBall({ row: 3, col: aiToCol, spin: 'TOPSPIN', fromRow: row, fromCol: aiFromCol }); setTurn('PLAYER'); }
      else { addLog('상대: 아웃!', 'system'); winPoint('player'); }
      return;
    }

    // ── 상회전 계열 (TOPSPIN, FAST_TOP, LOOP_SPIN, POWER_SPIN) ──
    if (spin === 'TOPSPIN' || spin === 'FAST_TOP' || spin === 'LOOP_SPIN' || spin === 'POWER_SPIN') {
      if (spin === 'POWER_SPIN') {
        addLog('상대: 💥 파워드라이브! [블록] 시도!', 'opponent');
        if (Math.random() < 0.30) {
          setBall({ row: Math.random() > 0.5 ? 2 : 3, col: aiToCol, spin: 'BLOCK_RETURN', fromRow: row, fromCol: aiFromCol });
          setTurn('PLAYER');
        } else { addLog('상대: 파워에 밀렸다!', 'system'); winPoint('player'); }
        return;
      }
      if (spin === 'LOOP_SPIN') {
        addLog('상대: 루프 회전!', 'opponent');
        if (Math.random() < 0.5) {
          addLog('상대: [블록] — 회전에 밀려 뜹니다.', 'opponent');
          if (Math.random() < 0.50) { pushOpponentHistory('블록'); setBall({ row: Math.random() > 0.5 ? 2 : 3, col: aiToCol, spin: 'BLOCK_RETURN', fromRow: row, fromCol: aiFromCol }); setTurn('PLAYER'); }
          else { addLog('상대: 블록 미스!', 'system'); winPoint('player'); }
        } else {
          addLog(`상대: 🌀 [카운터] ${dirLabel}!`, 'opponent');
          if (Math.random() < calcChance(0.48, aiFromCol, row, aiToCol)) { pushOpponentHistory('카운터'); setBall({ row: 3, col: aiToCol, spin: 'TOPSPIN', fromRow: row, fromCol: aiFromCol }); setTurn('PLAYER'); }
          else { addLog('상대: 카운터 미스!', 'system'); winPoint('player'); }
        }
        return;
      }
      // TOPSPIN / FAST_TOP
      const r2 = Math.random();
      if (r2 < 0.30) {
        addLog('상대: 🛡️ [블록]', 'opponent');
        if (Math.random() < (spin === 'FAST_TOP' ? 0.35 : 0.62)) {
          pushOpponentHistory('블록'); setBall({ row: Math.random() > 0.5 ? 2 : 3, col: aiToCol, spin: 'BLOCK_RETURN', fromRow: row, fromCol: aiFromCol }); setTurn('PLAYER');
        } else { addLog('상대: 블록 미스!', 'system'); winPoint('player'); }
      } else if (r2 < 0.65) {
        addLog(`상대: 🌀 [카운터] ${dirLabel}!`, 'opponent');
        if (Math.random() < calcChance(0.55, aiFromCol, row, aiToCol)) { pushOpponentHistory('카운터'); setBall({ row: 3, col: aiToCol, spin: 'TOPSPIN', fromRow: row, fromCol: aiFromCol }); setTurn('PLAYER'); }
        else { addLog('상대: 카운터 미스!', 'system'); winPoint('player'); }
      } else {
        addLog('상대: 🪂 [로빙] — 높게 올립니다!', 'opponent');
        pushOpponentHistory('로빙'); setBall({ row: 3, col: aiToCol, spin: 'LOB_SPIN', lobPenalty: 0, fromRow: row, fromCol: aiFromCol }); setTurn('PLAYER');
      }
      return;
    }

    // ── 짧은공 (row 1) ──
    if (row === 1) {
      if (spin === 'BACKSPIN' || spin === 'SIDESPIN' || spin === 'SIDESPIN_BACK') {
        const isSide = spin === 'SIDESPIN' || spin === 'SIDESPIN_BACK';
        // 짧은 공 대응: 안전 플레이 위주 (공격은 20% 이하로 제한)
        const r = Math.random();
        if (r < 0.30) {
          pushOpponentHistory('스톱'); addLog('상대: [스톱]', 'opponent'); setBall({ row: 2, col: aiToCol, spin: 'BACKSPIN' });
        } else if (r < 0.55) {
          addLog('상대: [보스커트]', 'opponent');
          if (isSide && Math.random() < 0.85) {
            pushOpponentHistory('보스커트 에러'); addLog('횡회전에 밀려 아웃!', 'system'); winPoint('player'); return;
          } else if (isSide) {
            pushOpponentHistory('보스커트'); addLog('간신히 넘어갔지만 공이 붕 뜹니다!', 'system'); setBall({ row: 3, col: aiToCol, spin: 'BLOCK_RETURN' });
          } else {
            pushOpponentHistory('보스커트'); setBall({ row: 3, col: aiToCol, spin: 'BACKSPIN' });
          }
        } else if (r < 0.80) { pushOpponentHistory('쇼트'); addLog('상대: [쇼트]', 'opponent');     setBall({ row: 2, col: aiToCol, spin: 'BACKSPIN' }); }
        else if (r < 0.92) {
          addLog(`상대: ⚡ [플릭] ${dirLabel}!`, 'opponent');
          if (Math.random() < calcChance(0.60, aiFromCol, row, aiToCol)) { pushOpponentHistory('플릭'); setBall({ row: 3, col: aiToCol, spin: 'TOPSPIN', fromRow: row, fromCol: aiFromCol }); }
          else { addLog('상대: 플릭 미스!', 'system'); winPoint('player'); return; }
        } else {
          addLog(`상대: 🎯 [치키타] ${dirLabel}!`, 'opponent');
          if (Math.random() < calcChance(0.35, aiFromCol, row, aiToCol)) { pushOpponentHistory('치키타'); setBall({ row: 3, col: aiToCol, spin: 'TOPSPIN', fromRow: row, fromCol: aiFromCol }); }
          else { addLog('상대: 치키타 미스!', 'system'); winPoint('player'); return; }
        }
      } else if (spin === 'TOPSPIN' || spin === 'SIDESPIN_TOP') {
        addLog(`상대: ${spin === 'SIDESPIN_TOP' ? '횡상회전에 속아!' : '상회전에 속았습니다!'}`, 'opponent');
        addLog('공이 붕 뜹니다! 스매시 찬스!', 'system');
        setBall({ row: 2, col: aiToCol, spin: 'FLOAT' });
      } else if (spin === 'KNUCKLE') {
        addLog('상대: ⚪ 너클 바운드...', 'opponent');
        if (Math.random() < 0.30) { addLog('상대: 리시브 미스!', 'system'); winPoint('player'); return; }
        if (Math.random() < 0.5) { addLog('상대: [스톱]', 'opponent'); setBall({ row: 2, col: aiToCol, spin: 'BACKSPIN' }); }
        else { addLog('상대: [보스커트]', 'opponent'); setBall({ row: 3, col: aiToCol, spin: 'BACKSPIN' }); }
      } else if (spin === 'DOUBLE_BOUNCE') {
        addLog('상대: 더블바운드! 처리 어렵다...', 'opponent');
        if (Math.random() < 0.35) { addLog('상대: 네트 에러!', 'system'); winPoint('player'); return; }
        if (Math.random() < 0.5) { addLog('상대: [스톱] 간신히', 'opponent'); setBall({ row: 2, col: aiToCol, spin: 'BACKSPIN' }); }
        else { addLog('상대: [보스커트]', 'opponent'); setBall({ row: 3, col: aiToCol, spin: 'BACKSPIN' }); }
      }
      setTurn('PLAYER'); return;
    }

    // ── 긴공 (row 0) ──
    if (row === 0) {
      if (spin === 'FAST_TOP') {
        addLog('상대: 당황! [블록]', 'opponent');
        if (Math.random() > 0.55) { setBall({ row: 3, col: aiToCol, spin: 'TOPSPIN' }); setTurn('PLAYER'); }
        else { addLog('서브 에이스!', 'system'); winPoint('player'); }
        return;
      }
      if (spin === 'LONG_BACK' || spin === 'BACKSPIN') {
        const r = Math.random();
        if (r < 0.28) { pushOpponentHistory('맞커트'); addLog('상대: [맞커트]', 'opponent'); setBall({ row: 3, col: aiToCol, spin: 'BACKSPIN' }); setTurn('PLAYER'); }
        else if (r < 0.50) { addLog(`상대: 🔥 [드라이브] ${dirLabel}!`, 'opponent');
          if (Math.random() < calcChance(0.70, aiFromCol, row, aiToCol)) { pushOpponentHistory('드라이브'); setBall({ row: 3, col: aiToCol, spin: 'TOPSPIN', fromRow: row, fromCol: aiFromCol }); setTurn('PLAYER'); }
          else { addLog('상대: 드라이브 네트!', 'system'); winPoint('player'); }
        } else if (r < 0.75) { addLog(`상대: 🌀 [루프] ${dirLabel}!`, 'opponent');
          if (Math.random() < calcChance(0.65, aiFromCol, row, aiToCol)) { pushOpponentHistory('루프'); setBall({ row: 3, col: aiToCol, spin: 'LOOP_SPIN', fromRow: row, fromCol: aiFromCol }); setTurn('PLAYER'); }
          else { addLog('상대: 루프 네트!', 'system'); winPoint('player'); }
        } else { addLog(`상대: 💥 [파워드라이브] ${dirLabel}!`, 'opponent');
          if (Math.random() < calcChance(0.60, aiFromCol, row, aiToCol)) { pushOpponentHistory('파워드라이브'); setBall({ row: 3, col: aiToCol, spin: 'POWER_SPIN', fromRow: row, fromCol: aiFromCol }); setTurn('PLAYER'); }
          else { addLog('상대: 파워드라이브 아웃!', 'system'); winPoint('player'); }
        }
        return;
      }
      if (spin === 'LONG_SIDE') {
        addLog('상대: 긴 횡회전...', 'opponent');
        if (Math.random() < 0.22) { addLog('상대: 방향 오판! 에러!', 'system'); winPoint('player'); return; }
        if (Math.random() < 0.5) { addLog('상대: [맞커트]', 'opponent'); setBall({ row: 3, col: aiToCol, spin: 'BACKSPIN' }); }
        else { addLog(`상대: [드라이브] ${dirLabel}!`, 'opponent');
          if (Math.random() < calcChance(0.62, aiFromCol, row, aiToCol)) { setBall({ row: 3, col: aiToCol, spin: 'TOPSPIN', fromRow: row, fromCol: aiFromCol }); }
          else { addLog('상대: 드라이브 네트!', 'system'); winPoint('player'); return; }
        }
        setTurn('PLAYER'); return;
      }
      if (spin === 'KNUCKLE') {
        addLog('상대: ⚪ 너클 바운드...', 'opponent');
        if (Math.random() < 0.35) { addLog('상대: 에러!', 'system'); winPoint('player'); return; }
        addLog('상대: [블록]으로 간신히', 'opponent');
        setBall({ row: 3, col: aiToCol, spin: 'BLOCK_RETURN' }); setTurn('PLAYER'); return;
      }
    }
  };

  // ── 공 시각화 ──
  const spinMeta = {
    BACKSPIN:      { label:'⬇️ 하회전',   color:'#facc15', glow:'rgba(250,204,21,0.7)',  pulse:false },
    TOPSPIN:       { label:'⬆️ 상회전',   color:'#f97316', glow:'rgba(249,115,22,0.8)',  pulse:false },
    LOOP_SPIN:     { label:'🌀 루프',      color:'#fb923c', glow:'rgba(251,146,60,0.9)',  pulse:true  },
    POWER_SPIN:    { label:'💥 파워',      color:'#dc2626', glow:'rgba(220,38,38,0.95)',  pulse:true  },
    SIDESPIN:      { label:'↩️ 횡회전',   color:'#a78bfa', glow:'rgba(167,139,250,0.85)',pulse:false },
    SIDESPIN_BACK: { label:'↙️ 횡하회전', color:'#c084fc', glow:'rgba(192,132,252,0.85)',pulse:false },
    SIDESPIN_TOP:  { label:'↖️ 횡상회전', color:'#e879f9', glow:'rgba(232,121,249,0.85)',pulse:false },
    FAST_TOP:      { label:'⚡ 빠른서브', color:'#ef4444', glow:'rgba(239,68,68,0.9)',   pulse:false },
    LONG_BACK:     { label:'⬇️ 긴하회전', color:'#fde047', glow:'rgba(253,224,71,0.75)', pulse:false },
    LONG_SIDE:     { label:'↩️ 긴횡회전', color:'#818cf8', glow:'rgba(129,140,248,0.85)',pulse:false },
    DOUBLE_BOUNCE: { label:'🏀 더블바운드',color:'#6ee7b7', glow:'rgba(110,231,183,0.8)', pulse:false },
    KNUCKLE:       { label:'⚪ 너클',      color:'#e2e8f0', glow:'rgba(226,232,240,0.7)', pulse:false },
    LOB_SPIN:      { label:'🪂 로빙',      color:'#bae6fd', glow:'rgba(186,230,253,0.75)',pulse:true  },
    FLOAT:         { label:'☁️ 뜬 공!',   color:'#ffffff', glow:'rgba(255,255,255,0.9)', pulse:true  },
    BLOCK_RETURN:  { label:'🫧 블록뜬공', color:'#7dd3fc', glow:'rgba(125,211,252,0.85)',pulse:true  },
  };

  // ── 테이블 렌더 ──
  const renderTableWithPath = () => {
    const cellH = 90, cellW = 100, W = 200, H = 360;
    const haspath = ball?.fromRow !== undefined && ball?.fromCol !== undefined;
    const pathEl = haspath ? (() => {
      // 공 셀: ball(26px) + gap(4px) + label(~12px) = 42px → 셀(90px) 중앙보다 8px 위에 공 중심
      const BALL_OFFSET = 8;
      const fx = ball.fromCol * cellW + cellW / 2;
      const fy = ball.fromRow * cellH + cellH / 2 - BALL_OFFSET;
      const tx = ball.col * cellW + cellW / 2;
      const ty = ball.row * cellH + cellH / 2 - BALL_OFFSET;
      const isCross = ball.fromCol !== ball.col;
      const sc = isCross ? '#34d399' : '#fbbf24';
      const sc2 = isCross ? '#6ee7b7' : '#fde68a';

      const gId = `ag${isCross?'c':'s'}`;
      const mId = `mh${isCross?'c':'s'}`;
      const labelX = (fx + tx) / 2;
      const labelY = (fy + ty) / 2 - 8;
      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:5 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gId} gradientUnits="userSpaceOnUse" x1={fx} y1={fy} x2={tx} y2={ty}>
              <stop offset="0%"   stopColor={sc}  stopOpacity="0.15"/>
              <stop offset="55%"  stopColor={sc}  stopOpacity="0.8"/>
              <stop offset="100%" stopColor={sc2} stopOpacity="1"/>
            </linearGradient>
            <marker id={mId} markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
              <polygon points="0,0 8,4 0,8" fill={sc2} opacity="0.95"/>
            </marker>
          </defs>
          {/* 글로우 레이어 */}
          <line x1={fx} y1={fy} x2={tx} y2={ty} stroke={sc} strokeWidth="6" opacity="0.12" strokeLinecap="round"/>
          {/* 메인 직선 */}
          <line x1={fx} y1={fy} x2={tx} y2={ty}
            stroke={`url(#${gId})`} strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="8 4" markerEnd={`url(#${mId})`}/>
          {/* 방향 라벨 */}
          <text x={labelX} y={labelY} fill={sc2} fontSize="9" fontWeight="bold" textAnchor="middle"
            style={{ filter:'drop-shadow(0 1px 3px rgba(0,0,0,1))' }}>
            {isCross ? (ball.fromRow >= 2 ? '깊은크로스' : '크로스') : (ball.fromRow >= 2 ? '깊은전환' : '스트레이트')}
          </text>
        </svg>
      );
    })() : null;
    return (
      <div style={{ background:'#1a4d8c',borderRadius:'10px',border:'5px solid #0f2a52',boxShadow:'0 8px 32px rgba(0,0,0,0.6)',overflow:'visible',position:'relative',aspectRatio:'152.5/274',width:'100%' }}>
        {/* 세로 RPM 게이지 — 오른쪽 상단 */}
        {ball && (
          <div style={{ position:'absolute', top:'4px', right:'-36px', width:'28px', height:'140px', background:'rgba(15,23,42,0.82)', borderRadius:'8px', border:'1px solid rgba(148,163,184,0.15)', boxShadow:'0 4px 16px rgba(0,0,0,0.5)', zIndex:10, display:'flex', flexDirection:'column' }}>
            {renderSpinGauge()}
          </div>
        )}
        <div style={{ position:'absolute',left:'50%',top:0,bottom:0,width:'1px',background:'rgba(255,255,255,0.28)',transform:'translateX(-50%)',pointerEvents:'none',zIndex:2 }} />
        {pathEl}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'repeat(4,1fr)',position:'relative',zIndex:3,height:'100%' }}>
          {[0,1,2,3].flatMap(r => [0,1].map(c => {
            const here = ball?.row === r && ball?.col === c;
            const isFrom = ball?.fromRow === r && ball?.fromCol === c;
            const meta = here ? (spinMeta[ball.spin] || spinMeta.BACKSPIN) : null;
            return (
              <div key={`${r}-${c}`} style={{ position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderRight:c===0?'1px solid rgba(255,255,255,0.2)':'none',borderBottom:r<3?'1px solid rgba(255,255,255,0.12)':'none',borderTop:r===2?'3px solid rgba(255,255,255,0.85)':'none',background:here?'rgba(255,255,255,0.08)':isFrom?'rgba(255,255,255,0.03)':'transparent' }}>
                {!here && <span style={{ fontSize:'9px',color:'rgba(255,255,255,0.12)',fontWeight:700,userSelect:'none' }}>{r<=1?'상대':'내'}{r%2===0?' 긴':' 짧'}</span>}
                {here && meta && (
                  <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'4px' }}>
                    <div style={{ width:'26px',height:'26px',borderRadius:'50%',background:meta.color,border:'1.5px solid rgba(255,255,255,0.4)',boxShadow:`0 0 18px 7px ${meta.glow}`,animation:meta.pulse?'bpulse 0.9s infinite':'bbounce 0.55s infinite alternate' }} />
                    <span style={{ fontSize:'9px',fontWeight:700,color:'#fff',background:'rgba(0,0,0,0.75)',padding:'1px 6px',borderRadius:'4px',whiteSpace:'nowrap' }}>{meta.label}</span>
                  </div>
                )}
              </div>
            );
          }))}
        </div>
      </div>
    );
  };

  // ── RPM 게이지 렌더러 ──
  const renderSpinGauge = () => {
    if (!ball) return null;
    const rpm = SPIN_RPM[ball.spin] ?? 0;
    const absRpm = Math.abs(rpm);
    const isBack = rpm < -1000;
    const isTop  = rpm >  1000;
    const trackColor = isBack ? '#3b82f6' : isTop ? '#f97316' : '#94a3b8';
    // 세로 게이지: 위=상회전, 아래=하회전
    // pct: 위쪽이 100%, 아래쪽이 0% → 상회전이면 위로, 하회전이면 아래로
    const needlePct = ((-rpm) / MAX_RPM) * 50 + 50; // 위=0%, 아래=100%
    const fillTop   = rpm > 0 ? `${needlePct}%` : '50%';
    const fillHeight = `${(absRpm / MAX_RPM) * 50}%`;
    const rpmText = absRpm >= 100 ? `${absRpm.toLocaleString()}` : '0';
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', height:'100%', padding:'4px 0' }}>
        {/* 상회전 라벨 */}
        <span style={{ fontSize:'8px', color: isTop ? '#f97316' : 'rgba(148,163,184,0.4)', fontWeight: isTop ? 700 : 400, lineHeight:1 }}>상⬆</span>
        {/* 세로 트랙 */}
        <div style={{ position:'relative', flex:1, width:'10px', background:'rgba(15,23,42,0.8)', borderRadius:'5px', border:'1px solid rgba(255,255,255,0.12)', overflow:'visible', minHeight:'60px' }}>
          {/* 배경 그라디언트 */}
          <div style={{ position:'absolute', inset:0, borderRadius:'4px', background:'linear-gradient(to bottom, rgba(249,115,22,0.2), rgba(15,23,42,0) 50%, rgba(59,130,246,0.2))', pointerEvents:'none' }} />
          {/* 중앙 기준선 */}
          <div style={{ position:'absolute', top:'50%', left:'-3px', right:'-3px', height:'2px', background:'rgba(255,255,255,0.25)', transform:'translateY(-50%)', borderRadius:'1px' }} />
          {/* RPM 채움 바 */}
          {absRpm > 0 && (
            <div style={{ position:'absolute', left:'1px', right:'1px', top:fillTop, height:fillHeight, background:`linear-gradient(${isTop?'to top':'to bottom'}, ${trackColor}44, ${trackColor})`, borderRadius:'3px', boxShadow:`0 0 8px 2px ${trackColor}55`, transition:'all 0.4s ease' }} />
          )}
          {/* 바늘 */}
          <div style={{ position:'absolute', top:`${needlePct}%`, left:'-4px', right:'-4px', height:'4px', background:'#fff', borderRadius:'2px', transform:'translateY(-50%)', boxShadow:`0 0 6px 2px ${trackColor}, 0 0 2px rgba(255,255,255,0.9)`, transition:'top 0.4s ease', zIndex:2 }} />
        </div>
        {/* 하회전 라벨 */}
        <span style={{ fontSize:'8px', color: isBack ? '#3b82f6' : 'rgba(148,163,184,0.4)', fontWeight: isBack ? 700 : 400, lineHeight:1 }}>하⬇</span>
        {/* RPM 수치 */}
        <span style={{ fontSize:'8px', fontWeight:900, color:trackColor, lineHeight:1, writingMode:'horizontal-tb', textAlign:'center', whiteSpace:'nowrap' }}>{rpmText}</span>
      </div>
    );
  };

  // ── 버튼 정의 ──
  const btnBase = { border:'none',cursor:'pointer',borderRadius:'8px',fontWeight:700,transition:'all 0.15s',fontFamily:'inherit',lineHeight:1.3,touchAction:'manipulation',WebkitTapHighlightColor:'transparent',minHeight:'44px' };
  const mk = (label, action, color, sub, full) => ({ label, action, color, sub, full });

  const getButtons = () => {
    // 서브 탭 UI는 별도 렌더러에서 처리 → 여기서는 null 반환
    if (!ball) return null;

    // 카운터 세부 선택 중
    if (pendingAction === 'COUNTER_DRIVE') return [
      { label:'🌀 안정적 카운터', action:'COUNTER_STABLE', color:'#4a1d96', sub:'성공률 높음', full:true },
      { label:'💥 파워드라이브',   action:'COUNTER_POWER',  color:'#7f1d1d', sub:'강타·고위험', full:true },
      { label:'↩️ 취소',          action:'CANCEL',          color:'#1e293b', sub:null,         full:true },
    ];

    const { row, spin } = ball;

    // 짧은공 리시브
    const shortDefensive = [mk('스톱','STOP','#334155','네트 앞'), mk('쇼트','SHORT_BLOCK','#1e3a5f','짧게 밀기'), mk('보스커트','PUSH','#334155','깊이 찌르기')];
    const shortAttack    = [mk('플릭 ⚡','FLICK','#92400e','선제공격'), mk('치키타','CHIQUITA','#7c3aed','BH 커브')];
    const shortBackBtns  = [...shortDefensive, ...shortAttack];
    const shortTopBtns   = [...shortAttack, mk('스톱 ⚠','STOP','#1e293b','공 뜰 수 있음'), mk('보스커트','PUSH','#334155','길게 밀기')];

    if (row===2 && spin==='BACKSPIN')      return shortBackBtns;
    if (row===2 && spin==='TOPSPIN')       return shortTopBtns;
    if (row===2 && spin==='SIDESPIN')      return shortBackBtns;
    if (row===2 && spin==='SIDESPIN_BACK') return shortBackBtns;
    if (row===2 && spin==='SIDESPIN_TOP')  return shortTopBtns;
    if (row===2 && spin==='KNUCKLE')       return [mk('스톱','STOP','#334155','조심'), mk('쇼트','SHORT_BLOCK','#1e3a5f','짧게'), mk('보스커트','PUSH','#334155','깊이'), mk('플릭 ⚡','FLICK','#92400e','⚠불규칙')];
    if (row===2 && spin==='DOUBLE_BOUNCE') return [mk('스톱','STOP','#334155','⚠매우짧음'), mk('쇼트','SHORT_BLOCK','#1e3a5f','빠르게'), mk('플릭 ⚡','FLICK','#92400e','⚠어려움')];
    if (row===2 && (spin==='BLOCK_RETURN'||spin==='FLOAT')) return [mk('💥 스매시 찬스!','SMASH','#854d0e',null,true)];

    // 긴공 리시브
    const longBackBtns = [mk('맞커트','CUT','#334155','안전 수비'), mk('🔥 드라이브','DRIVE','#9a3412','방향 선택'), mk('🌀 루프','LOOP','#b45309','강한 회전'), mk('💥 파워드라이브','POWER_DRIVE','#7f1d1d','강타'), mk('🔵 BH드라이브','BH_DRIVE','#1e40af','백핸드')];
    if (row===3 && (spin==='BACKSPIN'||spin==='LONG_BACK'||spin==='SIDESPIN_BACK')) return longBackBtns;
    if (row===3 && (spin==='SIDESPIN'||spin==='LONG_SIDE')) return [mk('맞커트','CUT','#334155','방향 주의'), mk('🔥 드라이브','DRIVE','#9a3412','방향 선택'), mk('🌀 루프','LOOP','#b45309','강한 회전')];
    if (row===3 && spin==='KNUCKLE') return [mk('맞커트','CUT','#334155','⚠불규칙'), mk('🔥 드라이브','DRIVE','#9a3412','⚠어려움')];
    if (row===3 && (spin==='TOPSPIN'||spin==='FAST_TOP'||spin==='LOOP_SPIN')) return [
      mk('🛡️ 블록','BLOCK','#0c4a6e', spin==='LOOP_SPIN'?'루프!뜬공주의':spin==='FAST_TOP'?'빠른서브':'뜬공주의',true),
      mk('🌀 카운터','COUNTER_DRIVE','#4a1d96','방향 선택 →',true),
      mk('🪂 로빙','LOB','#164e63','높게 올리기',true),
    ];
    if (row===3 && spin==='POWER_SPIN') return [
      mk('🛡️ 블록 (위험!)','BLOCK','#7f1d1d','성공률 30%',true),
      mk('🪂 로빙','LOB','#164e63','피하기',true),
    ];
    if (row===3 && spin==='BLOCK_RETURN') return [mk('🔥 드라이브 (뜬공!)','DRIVE','#b45309','+15% 찬스',true), mk('🛡️ 블록 (뜬공루프)','BLOCK','#164e63','뜬공 반복',true)];
    if (row===3 && spin==='LOB_SPIN')     return [mk('💥 스매시! (로빙)','SMASH','#854d0e','성공률 92%!',true)];
    return [];
  };

  // ── 서브 탭 렌더러 ──
  const renderServePanel = () => {
    const list = serveTab === 'SHORT' ? SERVES_SHORT : SERVES_LONG;
    return (
      <div style={{ width:'100%',display:'flex',flexDirection:'column',gap:'8px' }}>
        {/* 탭 */}
        <div style={{ display:'flex',gap:'6px' }}>
          {[['SHORT','📌 짧은 서브'],['LONG','🚀 긴 서브']].map(([tab, label]) => (
            <button key={tab} onClick={() => setServeTab(tab)} className="gbtn"
              style={{ ...btnBase, flex:1, padding:'7px', fontSize:'12px',
                background: serveTab===tab ? '#3b82f6' : 'rgba(30,41,59,0.8)',
                color: serveTab===tab ? '#fff' : '#94a3b8',
                border: serveTab===tab ? '2px solid #60a5fa' : '2px solid rgba(148,163,184,0.2)',
              }}>
              {label}
            </button>
          ))}
        </div>
        {/* 서브 버튼 그리드 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px' }}>
          {list.map(({ label, action, color, sub }) => {
            const lv = skills[action]?.lv ?? 1;
            const pct = Math.round(lvBonus(lv) * 100);
            return (
              <button key={action} onClick={() => handlePlayerAction(action)} className="gbtn"
                style={{ ...btnBase, padding:'11px 8px', background:color, color:'#fff', fontSize:'13px' }}>
                {label}<br />
                <span style={{ fontWeight:400, opacity:0.75, fontSize:'10px' }}>{sub}</span>
                {pct > 0 && <><br /><span style={{ fontWeight:700, fontSize:'10px', color:'#6ee7b7' }}>+{pct}%</span></>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };


  const buttons = getButtons();

  return (
    <div style={{ minHeight:'100dvh',background:'linear-gradient(160deg,#0f172a 0%,#1e293b 55%,#0f172a 100%)',color:'#f1f5f9',display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 12px',paddingTop:'max(8px, env(safe-area-inset-top))',paddingBottom:'max(8px, env(safe-area-inset-bottom))',fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",boxSizing:'border-box' }}>
      <style>{`
        @keyframes bbounce { from{transform:translateY(0)} to{transform:translateY(-6px)} }
        @keyframes bpulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.15)} }
        @keyframes bspin   { to{transform:rotate(360deg)} }
        @keyframes lvflash { 0%{transform:translateX(-50%) scale(1)} 40%{transform:translateX(-50%) scale(1.08)} 100%{transform:translateX(-50%) scale(1)} }
        .gbtn:hover { filter:brightness(1.18); }
        .gbtn:active { transform:scale(0.96); }
        * { box-sizing: border-box; }
      `}</style>

      {/* 레벨업 플래시 */}
      {levelUpFlash && (
        <div style={{ position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#854d0e,#f59e0b)',color:'#fff',padding:'10px 22px',borderRadius:'12px',fontWeight:900,fontSize:'14px',zIndex:100,boxShadow:'0 4px 24px rgba(245,158,11,0.5)',animation:'lvflash 0.4s ease',whiteSpace:'nowrap' }}>
          🆙 {SKILL_NAMES[levelUpFlash.skill]} Lv{levelUpFlash.newLv} 달성!
        </div>
      )}


      {gameState === 'START' ? (
        <div style={{ width:'100%',maxWidth:'420px',background:'rgba(30,41,59,0.92)',borderRadius:'16px',padding:'28px 22px',border:'1px solid rgba(148,163,184,0.14)',boxShadow:'0 8px 32px rgba(0,0,0,0.5)',marginTop:'16px' }}>
          <h1 style={{ fontSize:'27px',fontWeight:900,textAlign:'center',marginBottom:'6px',background:'linear-gradient(135deg,#60a5fa,#818cf8)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent' }}>🏓 MindTT</h1>
          <p style={{ textAlign:'center',color:'#64748b',fontSize:'12px',marginBottom:'16px' }}>전술적 탁구 — 서브·경로·레벨업으로 상대를 제압하라</p>
          <div style={{ background:'rgba(15,23,42,0.7)',borderRadius:'10px',padding:'14px',marginBottom:'16px',display:'flex',flexDirection:'column',gap:'5px' }}>
            <p style={{ fontWeight:700,fontSize:'12px',marginBottom:'4px',color:'#cbd5e1' }}>📋 시스템 가이드</p>
            {[
              ['#60a5fa','짧은 하회전','정석. 안전.'],
              ['#fb923c','짧은 상회전','커트 함정.'],
              ['#a78bfa','횡회전 계열','방향 혼란.'],
              ['#6ee7b7','더블 바운드','매우 짧음. AI 에러 유발.'],
              ['#94a3b8','너클','불규칙 바운드. AI 에러 유발.'],
              ['#ef4444','긴 빠른 상회전','기습 에이스.'],
              ['#fde047','긴 하회전','낮고 깊게.'],
              ['#818cf8','긴 횡회전','깊은 사이드스핀.'],
              ['#34d399','크로스','자연스러운 방향 +5%.'],
              ['#fbbf24','스트레이트','방향 전환. 깊을수록 ↓'],
              ['#bae6fd','로빙','수비용. 레벨업할수록 AI 스매시 성공률 ↓'],
              ['#fde68a','레벨업','기술 반복 → 성공률 ↑'],
            ].map(([c,l,d]) => (
              <div key={l} style={{ display:'flex',gap:'8px',alignItems:'flex-start' }}>
                <span style={{ width:'7px',height:'7px',borderRadius:'50%',background:c,marginTop:'3px',flexShrink:0 }} />
                <span style={{ color:'#94a3b8',fontSize:'11px' }}><b style={{ color:c }}>{l}:</b> {d}</span>
              </div>
            ))}
          </div>
          <button onClick={startGame} className="gbtn" style={{ ...btnBase,width:'100%',padding:'14px',background:'linear-gradient(135deg,#3b82f6,#6366f1)',color:'#fff',fontSize:'16px' }}>
            게임 시작 (5점 내기)
          </button>
        </div>
      ) : (
        <div style={{ width:'100%',maxWidth:'480px',display:'flex',flexDirection:'column',gap:'6px' }}>
          {/* 탁구대 + 양옆 점수 */}
          <div style={{ display:'flex',alignItems:'stretch',gap:'6px' }}>
            {/* 상대 점수 (왼쪽) — 히스토리 위, 점수 아래 */}
            <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',gap:'4px',paddingBottom:'4px',overflow:'hidden' }}>
              <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',gap:'2px',width:'100%',overflow:'hidden',marginBottom:'2px' }}>
                {opponentHistory.map((h,i) => (
                  <span key={i} style={{ fontSize:'8px',color:i===0?'#fca5a5':'rgba(148,163,184,0.45)',fontWeight:i===0?700:400,textAlign:'center',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%' }}>{h.label}</span>
                ))}
              </div>
              <span style={{ fontSize:'11px',color:'#94a3b8' }}>상대</span>
              <span style={{ fontSize:'32px',fontWeight:900,color:'#f87171',lineHeight:1 }}>{score.opponent}</span>
              {server==='OPPONENT' && <span style={{ fontSize:'16px' }}>🏓</span>}
            </div>
            {/* 탁구대 */}
            <div style={{ flex:'0 0 56%' }}>{renderTableWithPath()}</div>
            {/* 내 점수 (오른쪽) — 히스토리 위, 점수 아래 */}
            <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',gap:'4px',paddingBottom:'4px',overflow:'hidden' }}>
              <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',gap:'2px',width:'100%',overflow:'hidden',marginBottom:'2px' }}>
                {moveHistory.map((h,i) => (
                  <span key={i} style={{ fontSize:'8px',color:i===0?'#93c5fd':'rgba(148,163,184,0.45)',fontWeight:i===0?700:400,textAlign:'center',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'100%' }}>
                    {h.label}{h.pct>0?` +${h.pct}%`:''}
                  </span>
                ))}
              </div>
              <span style={{ fontSize:'11px',color:'#94a3b8' }}>나</span>
              <span style={{ fontSize:'32px',fontWeight:900,color:'#60a5fa',lineHeight:1 }}>{score.player}</span>
              {server==='PLAYER' && <span style={{ fontSize:'16px' }}>🏓</span>}
            </div>
          </div>

          {/* 로그 */}
          <div style={{ height:'110px',background:'rgba(2,6,23,0.92)',borderRadius:'10px',padding:'6px 12px',overflowY:'auto',fontSize:'12px',border:'1px solid rgba(148,163,184,0.1)',display:'flex',flexDirection:'column',gap:'2px' }}>
            {logs.map((log, i) => {
              const isLatest = i === logs.length - 1;
              const isCenter = log.type==='system'||log.type==='levelup';
              return (
              <div key={i} style={{ color:log.type==='player'?'#93c5fd':log.type==='opponent'?'#fca5a5':'#fde68a', fontWeight:isLatest||isCenter?700:400, textAlign:isCenter?'center':'left', padding:isCenter?'2px 0':0, display:'flex', alignItems:'center', gap:'4px', justifyContent:isCenter?'center':'flex-start' }}>
                <span>{log.text}</span>
                {isLatest && <span style={{ color:'#fbbf24', fontWeight:900, flexShrink:0 }}>{'<<'}</span>}
              </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>

          {/* 액션 패널 */}
          <div style={{ background:'rgba(30,41,59,0.92)',borderRadius:'12px',padding:'10px',border:'1px solid rgba(148,163,184,0.1)',minHeight:'110px',display:'flex',alignItems:'center',justifyContent:'center' }}>
            {gameState === 'GAME_OVER' ? (
              <button onClick={startGame} className="gbtn" style={{ ...btnBase,width:'100%',padding:'12px',background:'#4f46e5',color:'#fff',fontSize:'15px' }}>다시 하기</button>
            ) : turn === 'OPPONENT' ? (
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',color:'#64748b' }}>
                <div style={{ width:'24px',height:'24px',border:'2px solid #475569',borderTopColor:'transparent',borderRadius:'50%',animation:'bspin 0.8s linear infinite' }} />
                <span style={{ fontSize:'13px',fontWeight:700 }}>상대방이 생각 중...</span>
              </div>
            ) : !ball ? renderServePanel()
              : buttons && buttons.length > 0 ? (
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',width:'100%' }}>
                {buttons.map(({ label, action, color, sub, full }) => {
                  const lv = skills[action]?.lv ?? 1;
                  const lvPct = Math.round(lvBonus(lv) * 100);
                  return (
                  <button key={action} onClick={() => handlePlayerAction(action)} className="gbtn"
                    style={{ ...btnBase, gridColumn:full?'1/-1':undefined, padding:action==='SMASH'?'16px':'11px 8px', background:color, color:action==='SMASH'?'#000':'#fff', fontSize:'13px', border:action==='BLOCK'?'2px solid #0ea5e9':action==='COUNTER_DRIVE'?'2px solid #7c3aed':'none', boxShadow:action==='SMASH'?'0 0 20px rgba(234,179,8,0.4)':'none' }}>
                    {label}
                    {sub && <><br /><span style={{ fontWeight:400,opacity:0.75,fontSize:'10px' }}>{sub}</span></>}
                    {lvPct > 0 && (
                      <><br /><span style={{ fontWeight:700,fontSize:'10px' }}>
                        <span style={{ color:'#6ee7b7' }}>+{lvPct}%</span>
                      </span></>
                    )}
                  </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ color:'#475569',fontSize:'12px' }}>...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
