/* -----------------------------------------------------------
   UI Generator: automatically creates stat inputs
----------------------------------------------------------- */
const STAT_FIELDS = [
  ['power', '총 피해'],
  ['hitrate', '기본 공격 속도'],
  ['speedbuff', '공격 속도(%)'],
  ['doubleproc', '더블 찬스(%)'],
  ['critproc', '치명타 확률(%)'],
  ['critbonus', '치명타 피해(%)'],
  ['drain', '생명력 흡수(%)'],
  ['regen', '체력 재생(%)'],
  ['guard', '블록 확률(%)'],
  ['vital', '총 체력'],
  ['hpmult', 'PVP 체력 보정(%)'],
  ['startup', '근접 딜레이(초)'],
  ['skillbonus', '스킬 피해(%)'],
  ['damagebonus', '피해(%)'],
  ['reduceCooltime', '스킬 재사용 대기시간(%)'],
];

function createInputs(container, prefix) {
  STAT_FIELDS.forEach(([key, label]) => {
    const row = document.createElement('label');
    row.innerHTML = `
      <span>${label}</span>
      <input type='number' id='${prefix}_${key}' value='0' step='0.01'>
    `;

    const input = row.querySelector('input');
    input.addEventListener('input', () => {
      // 숫자가 아닌 값 제거
      if (input.value !== '' && isNaN(input.value)) {
        input.value = '';
        return;
      }
      
      // 빈 값은 허용
      if (input.value === '') input.value = 0;
      
      const numValue = parseFloat(input.value);
      if (['doubleproc', 'critproc'].includes(key)) {
        if (numValue > 100) input.value = 100;
      }

      if (key === 'reduceCooltime' && numValue > 80) input.value = 80;
      if (numValue < 0) input.value = 0;
    });
    
    // paste 이벤트에서도 검증
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      if (!isNaN(pastedText) && pastedText !== '') {
        input.value = pastedText;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    container.appendChild(row);
  });
}

createInputs(document.querySelector('.groupA'), 'a');
createInputs(document.querySelector('.groupB'), 'b');

// Default input values (centralized) — 쉽게 변경/리셋 가능하도록 정의
const DEFAULT_INPUTS = {
  a: {
    power: 100, hitrate: 1.7, speedbuff: 0, doubleproc: 0, critproc: 0, critbonus: 0,
    drain: 0, regen: 0, guard: 0, vital: 1000, hpmult: 500, startup: 0,
    skillbonus: 0, damagebonus: 0, reduceCooltime: 0
  },
  b: {
    power: 100, hitrate: 1.7, speedbuff: 0, doubleproc: 0, critproc: 0, critbonus: 0,
    drain: 0, regen: 0, guard: 0, vital: 1000, hpmult: 500, startup: 0,
    skillbonus: 0, damagebonus: 0, reduceCooltime: 0
  }
};

function applyDefaults(prefix) {
  const defs = DEFAULT_INPUTS[prefix] || {};
  STAT_FIELDS.forEach(([key]) => {
    const el = document.getElementById(prefix + '_' + key);
    if (!el) return;
    el.value = (defs.hasOwnProperty(key) ? defs[key] : 0);
  });
  // clear selects
  const containerId = prefix === 'a' ? 'mySkills' : 'enemySkills';
  const container = document.getElementById(containerId);
  if (container) {
    container.querySelectorAll('select').forEach(s => s.value = '');
    updateExclusiveForContainer(container);
    updateAllSkillIcons(container);
  }
}

// Load saved values if present, otherwise apply defaults
function loadInputs(prefix) {
  const key = 'fmpsim_' + prefix;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) { applyDefaults(prefix); return; }
    const obj = JSON.parse(raw);
    STAT_FIELDS.forEach(([field]) => {
      const el = document.getElementById(prefix + '_' + field);
      if (!el) return;
      if (obj.hasOwnProperty(field)) el.value = obj[field];
      else el.value = 0;
    });
    // restore selects
    const selNames = obj.selectedSkills || [];
    const containerId = prefix === 'a' ? 'mySkills' : 'enemySkills';
    const container = document.getElementById(containerId);
    if (container) {
      const selects = Array.from(container.querySelectorAll('select'));
      for (let i = 0; i < selects.length; i++) {
        selects[i].value = selNames[i] || '';
      }
      updateExclusiveForContainer(container);
      updateAllSkillIcons(container);
    }
  } catch (e) {
    console.warn('loadInputs parse error', e);
    applyDefaults(prefix);
  }
}

function saveInputs(prefix) {
  const obj = {};
  STAT_FIELDS.forEach(([field]) => {
    const el = document.getElementById(prefix + '_' + field);
    obj[field] = el ? el.value : 0;
  });
  // save selected skills
  const containerId = prefix === 'a' ? 'mySkills' : 'enemySkills';
  const container = document.getElementById(containerId);
  obj.selectedSkills = [];
  if (container) {
    container.querySelectorAll('select').forEach(s => obj.selectedSkills.push(s.value || ''));
  }
  localStorage.setItem('fmpsim_' + prefix, JSON.stringify(obj));
}

function resetInputs(prefix) {
  applyDefaults(prefix);
  localStorage.removeItem('fmpsim_' + prefix);
}

// Apply load on startup
loadInputs('a');
loadInputs('b');

/* -----------------------------------------------------------
   Skill selector: dynamic options and UI
----------------------------------------------------------- */
const SKILL_NAME = [
  '외침', '화살', '고기', 
  '수리검', '포격', '광전사',
  '가시', '화살비', '버프',
  '운석', '폭탄', '사기',
  '쇄도', '벌레', '번개',
  '기총소사', '드론', '높은 사기'
];

// 관리자가 특정 상황에서 드롭다운에서 선택을 금지하고 싶은 스킬을
// 이 배열에 추가하면 해당 스킬은 모든 셀렉트에서 비활성화됩니다.
// 예: const IGNORE_SKILLS = ['고기', '드론'];
const IGNORE_SKILLS = [
  '운석',
  '쇄도', '벌레', '번개',
  '기총소사', '드론'
];

function createSelect(idPrefix) {
  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';

  const sel = document.createElement('select');
  sel.className = 'skill-select';
  sel.id = idPrefix;

  // 기본 비선택 옵션
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '--선택--';
  sel.appendChild(empty);

  SKILL_NAME.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt;
    // 만약 IGNORE 목록에 있으면 기본적으로 비활성화
    if (IGNORE_SKILLS.includes(opt)) o.disabled = true;
    sel.appendChild(o);
  });

  const icon = document.createElement('div');
  icon.className = 'skill-icon';

  sel.addEventListener('change', () => {
    const container = sel.closest('.skill-column');
    if (container) updateExclusiveForContainer(container);
    updateSkillIconForSelect(sel);
  });

  wrapper.appendChild(sel);
  wrapper.appendChild(icon);
  return wrapper;
}

function updateExclusiveForContainer(container) {
  const selects = Array.from(container.querySelectorAll('select'));
  const chosen = selects.map(s => s.value).filter(v => v);

  selects.forEach(s => {
    Array.from(s.options).forEach(opt => {
      if (!opt.value) { // '--선택--'
        opt.disabled = false;
        return;
      }

      const isIgnored = IGNORE_SKILLS.includes(opt.value);

      // 현재 select에서 선택한 값은 유지(선택 가능 상태로 보이도록),
      // 단, 관리자가 완전히 금지하길 원하면 isIgnored 처리만으로도 됨.
      if (s.value === opt.value) {
        // keep selected option enabled so it displays as selected
        opt.disabled = false;
      } else {
        // disabled if it's either chosen by another select or listed in IGNORE_SKILLS
        opt.disabled = isIgnored || chosen.includes(opt.value);
      }
    });
  });
}

function renderSkillSelectors() {
  const left = document.getElementById('mySkills');
  const right = document.getElementById('enemySkills');

  // clear any existing selects (but keep label)
  [...left.querySelectorAll('select')].forEach(n => n.remove());
  [...right.querySelectorAll('select')].forEach(n => n.remove());

  for (let i = 1; i <= 3; i++) {
    const sLwrap = createSelect('left_skill_' + i);
    left.appendChild(sLwrap);

    const sRwrap = createSelect('right_skill_' + i);
    right.appendChild(sRwrap);
  }

  // 초기 상태에서 중복 선택 불가 적용
  updateExclusiveForContainer(left);
  updateExclusiveForContainer(right);
}

// 스프라이트 행 인덱스는 `SKILL_NAME` 배열의 순서(index)와 일치합니다.

function updateSkillIconForSelect(sel) {
  const wrapper = sel.parentElement;
  const icon = wrapper.querySelector('.skill-icon');
  if (!icon) return;

  const v = sel.value;
  if (!v || SKILL_NAME.indexOf(v) === -1) {
    icon.style.visibility = 'hidden';
    return;
  }

  const idx = SKILL_NAME.indexOf(v);
  const SLICE_H = 48;
  const SHEET_H = 864; // fixed full image height in pixels

  if (idx < 0 || idx * SLICE_H >= SHEET_H) {
    icon.style.visibility = 'hidden';
    return;
  }

  icon.style.backgroundSize = `48px ${SHEET_H}px`;
  const posY = -(idx * SLICE_H);
  icon.style.backgroundPosition = `0px ${posY}px`;
  icon.style.visibility = 'visible';
}

function updateAllSkillIcons(container) {
  const selects = container.querySelectorAll('select');
    selects.forEach(s => {
      updateSkillIconForSelect(s);
    });
}

// initial render
renderSkillSelectors();
  // 초기 아이콘 상태 업데이트
  const left = document.getElementById('mySkills');
  const right = document.getElementById('enemySkills');
  updateAllSkillIcons(left);
  updateAllSkillIcons(right);

// Log rendering helpers: convert skill name arrays into small icon HTML
function skillIconsHTML(skillNames = [], buffSkillUsed = [], size = 48) {
  const newArray = [];
  if (skillNames.length > 0) {
    newArray.push(...skillNames);
  }

  if (buffSkillUsed.length > 0) {
    newArray.push(...buffSkillUsed);
  }

  if (newArray.length === 0) return '';

  // skill sprite sheet uses 48x48 per icon; we will scale down to `size`
  const SLICE_H = 48;
  const SHEET_H = 864;
  const icons = newArray.map(name => {
    const idx = SKILL_NAME.indexOf(name);
    if (idx === -1 || idx * SLICE_H >= SHEET_H) return '';
    const posY = -(idx * SLICE_H);
    // inline style to avoid adding many CSS classes
    const style = [
      `display:inline-block`,
      `width:${size}px`,
      `height:${size}px`,
      `background-image:url('skills.png')`,
      `background-repeat:no-repeat`,
      `background-size:48px ${SHEET_H}px`,
      `background-position:0px ${posY}px`,
      `margin-right:6px`,
      `vertical-align:middle`
    ].join(';');
    return `<span title="${escapeHtml(name)}" style="${style}"></span>`;
  });
  return icons.join('');
}

function escapeHtml(str) {
  return (str + '').replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}

/* -----------------------------------------------------------
   Skill data registry (metadata for each SKILL_OPTIONS entry)
   - 각 스킬 이름(key)은 SKILL_OPTIONS 배열의 값과 정확히 일치해야 합니다.
----------------------------------------------------------- */
// 모든 Skill은 전투 시작 시 5초의 cooltime이 적용됨.
const SKILL_DATA = {
  // 일반
  '외침': { name: '외침', isBuff: false, damage: 22, hit: 6, cooltime: 5, defaultCooltime: 6 },
  '화살': { name: '화살', isBuff: false, damage: 78, hit: 3, cooltime: 5, defaultCooltime: 7 },
  '고기': { name: '고기', isBuff: true, damage: 0, hit: 0, addAtk: 0, addHP: 118, cooltime: 5, defaultCooltime: 8, bufftime: 0, defaultBufftime: 10 },
  // 희귀
  '수리검': { name: '수리검', isBuff: false, damage: 316, hit: 5, cooltime: 5, defaultCooltime: 4 },
  '포격': { name: '포격', isBuff: false, damage: 527, hit: 3, cooltime: 5, defaultCooltime: 5 },
  '광전사': { name: '광전사', isBuff: true, damage: 0, hit: 0, addAtk: 1560, addHP: 0, cooltime: 5, defaultCooltime: 9, bufftime: 0, defaultBufftime: 10 },
  // 서사시
  '가시': { name: '가시', isBuff: false, damage: 24800, hit: 2, cooltime: 5, defaultCooltime: 6 },
  '화살비': { name: '화살비', isBuff: false, damage: 14500, hit: 8, cooltime: 5, defaultCooltime: 11 },
  '버프': { name: '버프', isBuff: true, damage: 0, hit: 0, addAtk: 12000, addHP: 96000, cooltime: 5, defaultCooltime: 10, bufftime: 0, defaultBufftime: 10 },
  // 전설
  '운석': { name: '운석', isBuff: false, damage: 0, hit: 1, cooltime: 5, defaultCooltime: 10 },
  '폭탄': { name: '폭탄', isBuff: false, damage: 336000, hit: 1, cooltime: 5, defaultCooltime: 7 },
  '사기': { name: '사기', isBuff: true, damage: 0, hit: 0, addAtk: 44800, addHP: 358000, cooltime: 5, defaultCooltime: 10, bufftime: 0, defaultBufftime: 10 },
  // 궁극
  '쇄도': { name: '쇄도', isBuff: false, damage: 0, hit: 1, cooltime: 5, defaultCooltime: 10 },
  '벌레': { name: '벌레', isBuff: false, damage: 0, hit: 1, cooltime: 5, defaultCooltime: 10 },
  '번개': { name: '번개', isBuff: false, damage: 0, hit: 1, cooltime: 5, defaultCooltime: 10 },
  // 신화
  '기총소사': { name: '기총소사', isBuff: false, damage: 4860000, hit: 3, cooltime: 5, defaultCooltime: 10 }, // 제보자: S2_한쪽팔없음/Armless (2렙 기준)
  '드론': { name: '드론', isBuff: false, damage: 1210000, hit: 8, cooltime: 5, defaultCooltime: 10 }, // 제보자: S2_한쪽팔없음/Armless (2렙 기준)
  '높은 사기': { name: '높은 사기', isBuff: true, damage: 0, hit: 0, addAtk: 2000000, addHP: 16000000, cooltime: 5, defaultCooltime: 10, bufftime: 0, defaultBufftime: 8 }
};

// 기본값 반환. SKILL_DATA에 정의되지 않은 스킬을 안전하게 처리하기 위함.
function getSkillData(name) {
  return SKILL_DATA[name] || null;
}

// prefix: 'a' (내 스킬) 또는 'b' (적 스킬)
function getSelectedSkillNames(prefix) {
  const containerId = prefix === 'mySkills' ? 'mySkills' : 'enemySkills';
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('select')).map(s => s.value).filter(Boolean);
}

// 선택된 스킬 이름 배열을 SKILL_DATA 객체로 변환한 배열 반환
function getSelectedSkillObjects(prefix) {
  return getSelectedSkillNames(prefix).map(name => getSkillData(name));
}

// wire up reset buttons
document.getElementById('resetA').addEventListener('click', () => {
  resetInputs('a');
});

document.getElementById('resetB').addEventListener('click', () => {
  resetInputs('b');
});

/* -----------------------------------------------------------
   Helper
----------------------------------------------------------- */
function num(id) { return +document.getElementById(id).value; }

function pretty(n) {
  return Math.abs(n) >= 1e6
    ? (n / 1e6).toFixed(2) + 'M'
    : Math.abs(n) >= 1e3
    ? (n / 1e3).toFixed(2) + 'K'
    : n.toFixed(2);
}

/* -----------------------------------------------------------
   Core Combat Math (rewritten structure)
----------------------------------------------------------- */
function loadFighter(prefix) {
  const maxHP = num(prefix + '_vital') * (num(prefix + '_hpmult') / 100);

  return {
    power: num(prefix + '_power'),
    hits: num(prefix + '_hitrate'),
    attackSpeed: 1 + (num(prefix + '_speedbuff') / 100),
    dbAttackRate: num(prefix + '_doubleproc') / 100,
    critRate: num(prefix + '_critproc') / 100,
    critDmg: 1.2 + (num(prefix + '_critbonus') / 100),
    drain: num(prefix + '_drain') / 100,
    regen: num(prefix + '_regen') / 100,
    block: num(prefix + '_guard') / 100,
    hp0: num(prefix + '_vital'),
    hpMax: maxHP,
    hpMult: num(prefix + '_hpmult') / 100,
    delay: num(prefix + '_startup'),
    skillDmgBonus: num(prefix + '_skillbonus') / 100,
    damageBonus: num(prefix + '_damagebonus') / 100,
    skillReduceCooltime: num(prefix + '_reduceCooltime') / 100,
  };
}

function getDamageByHit(user) {
  const critDamage = (user.power * user.critDmg * user.critRate) + (user.power * (1 - user.critRate));
  const dbDamegeRate = (2 * user.dbAttackRate) + (1 * (1 - user.dbAttackRate));
  const damage = critDamage * dbDamegeRate;
  return damage;
}

function battleSimulation2(me, enemy) {
  me = clone(me);
  me.current = clone(me);
  me.current.hp = me.hpMax;
  enemy = clone(enemy);
  enemy.current = clone(enemy);
  enemy.current.hp = enemy.hpMax;

  // 원거리의 경우 첫 공격까지 4초가 소요 됨.
  let delayTime = 40 + Math.max(me.delay * 10, enemy.delay * 10);

  let myEndTime = 0;
  let enemyEndTime = 0;
  const timeline = [];

  const mySkills = clone(getSelectedSkillObjects('mySkills'));
  const enemySkills = clone(getSelectedSkillObjects('enemySkills'));
  let t = 0;
  const dt = 1;

  // hit sec는 결과적으로 drain sec와 같음
  const myHitBySec = parseFloat(((me.hits * (1 / me.attackSpeed))).toFixed(1)) * 10;
  let myHitTimer = myHitBySec + me.delay * 10 < 41 ? 41 : myHitBySec + me.delay * 10;

  const enemyHitBySec = parseFloat(((enemy.hits * (1 / enemy.attackSpeed))).toFixed(1)) * 10;
  let enemyHitTimer = enemyHitBySec + enemy.delay * 10 < 41 ? 41 : enemyHitBySec + enemy.delay * 10;
  
  while (t < 601) {
    if (t < delayTime - 10) {
      t += dt;
      // 원거리 기준
      continue;
    }

    if (me.current.hp <= 0) {
      myEndTime = ((t-1)/10).toFixed(1);
      break;
    }

    if (enemy.current.hp <= 0) {
      enemyEndTime = ((t-1)/10).toFixed(1);
      break;
    }

    if ((me.current.hp <= 0 && enemy.current.hp <= 0) || t === 601) {
      break;
    }

    const myBattleData = {
      hitTimer: myHitTimer,
      hitBySec: myHitBySec
    }
    const myBattleInfoOnTick = calculateBattle(t, me, enemy, mySkills, myBattleData);
    myHitTimer = myBattleInfoOnTick.hitTimer;
    me = myBattleInfoOnTick.me;

    const enemyBattleData = {
      hitTimer: enemyHitTimer,
      hitBySec: enemyHitBySec
    }
    const enemyBattleInfoOnTick = calculateBattle(t, enemy, me, enemySkills, enemyBattleData);
    enemyHitTimer = enemyBattleInfoOnTick.hitTimer;
    enemy = enemyBattleInfoOnTick.me; // enemyBattleInfoOnTick에서는 me가 enemy임.
    
    
    const myHpOnTick = me.current.hp - enemyBattleInfoOnTick.damage + myBattleInfoOnTick.heal;
    const enemyHpOnTick = enemy.current.hp - myBattleInfoOnTick.damage + enemyBattleInfoOnTick.heal;
    console.log(t, me.current.hp, enemyBattleInfoOnTick.damage, myBattleInfoOnTick.heal, myHpOnTick);
    me.current.hp = myHpOnTick > me.current.hpMax ? me.current.hpMax : myHpOnTick;
    enemy.current.hp = enemyHpOnTick > enemy.current.hpMax ? enemy.current.hpMax : enemyHpOnTick;

    const myBattleResultOnTick = {
      time: (t/10).toFixed(1),
      hp: me.current.hp,
      skillUsed: myBattleInfoOnTick.skillUsed,
      buffSkillUsed: myBattleInfoOnTick.buffSkillUsed
    }

    const enemyBattleResultOnTick = {
      time: (t/10).toFixed(1),
      hp: enemy.current.hp,
      skillUsed: enemyBattleInfoOnTick.skillUsed,
      buffSkillUsed: enemyBattleInfoOnTick.buffSkillUsed
    }

    timeline.push({ me: myBattleResultOnTick, enemy: enemyBattleResultOnTick });
    t += dt;
  }

  return { time: t === 601 ? Infinity : ((t-1)/10), log: timeline, myEndHp: me.current.hp, enemyEndHp: enemy.current.hp, myEndTime, enemyEndTime };
}

function calculateBattle(t, me, enemy, skills, myBattleData) {
    let damage = 0;
    let skillUsed = [];
    let buffSkillUsed = [];

    hitTimer = myBattleData.hitTimer;
    hitBySec = myBattleData.hitBySec;

    // 내 Skill 처리
    if (skills !== null && skills.length > 0) {
      for (const skill of skills) {
        // 버프 만료
        if (skill.bufftime !== 0 && t === skill.bufftime * 10) {
          // 버프 지속 시간 종료 시 체력의 비율 만큼 원래 상태로 복원
          const resetHpMax = me.current.hpMax - (skill.addHP * me.hpMult);
          me.current.hp = resetHpMax * (me.current.hp/me.current.hpMax);
          me.current.hpMax = resetHpMax;
          // 버프 지속 시간 종료 시 원래 상태로 복원
          me.current.power -= skill.addAtk;
          // 버프의 경우 지속 시간 종료 시점에 cooltime 시작됨.
          skill.cooltime = skill.bufftime + skill.defaultCooltime * (1 - me.skillReduceCooltime);
        }

        if (t === skill.cooltime * 10) {
          if (skill.isBuff === true) {
            // 버프 스킬 처리 로직 (예: 공격력 증가, 체력 증가 등)
            me.current.power += skill.addAtk;
            me.current.hp += (skill.addHP * me.hpMult);
            me.current.hpMax += (skill.addHP * me.hpMult);
            skill.bufftime = t/10 + skill.defaultBufftime;
            buffSkillUsed.push(skill.name);
          } else {
            // 공격 스킬 처리 로직
            damage = skill.damage * skill.hit * (1 + me.skillDmgBonus) * (1 + me.damageBonus) * (1 - enemy.block);
            skill.cooltime += skill.defaultCooltime * (1 - me.skillReduceCooltime);
            skillUsed.push(skill.name);
          }
        }
      }
    }

    // 체젠은 0.1초 단위로 계산, 체뻥은 적용하지 않음.
    let heal = (me.hpMax * me.regen)/10;

    // 내 Hit 타이밍에 맞춰 데미지 / 흡혈 적용
    if (t === hitTimer) {
      const getDamage = getDamageByHit(me.current);
      const drain = getDamage * me.drain;
      heal += drain;

      damage += getDamage * (1 - enemy.block);
      hitTimer += hitBySec;
    }

    return { damage, heal, skillUsed, buffSkillUsed, me, hitTimer };
}

/* -----------------------------------------------------------
   Simulation Runner
----------------------------------------------------------- */
function startBattle() {
  // cache current inputs to localStorage so user's data persists
  saveInputs('a');
  saveInputs('b');

  let me = loadFighter('a');
  let enemy = loadFighter('b');
  const battleResult = battleSimulation2(me, enemy);
  const out = document.getElementById('battleResult');

  let msg = `
    내가 쓰러진 시간: ${battleResult.myEndTime === 0 ? '쓰러지지 않았다!' : battleResult.myEndTime + 's'}<br>
    적이 쓰러진 시간: ${battleResult.enemyEndTime === 0 ? '쓰러지지 않았다!' : battleResult.enemyEndTime + 's'}<br><br>
  `;

  if (battleResult.time === Infinity) {
    msg = `
        나의 남은 체력: ${pretty(battleResult.myEndHp)}<br>
        적의 남은 체력: ${pretty(battleResult.enemyEndHp)}<br><br>
    `;

    if (battleResult.myEndHp > battleResult.enemyEndHp)
      msg += '🥇 승리';
    else if (battleResult.enemyEndHp > battleResult.myEndHp)
      msg += '☠️ 패배';
    else
    msg += '🤝 무승부';
  } else if (battleResult.myEndTime === 0)
    msg += '🥇 승리';
  else if (battleResult.enemyEndTime === 0)
    msg += '☠️ 패배';
  else
    msg += '🤝 무승부';

  out.innerHTML = msg;

  me = loadFighter('a');
  enemy = loadFighter('b');
  logTimeline2(battleResult.log);
}

/* -----------------------------------------------------------
   Debug timeline table
----------------------------------------------------------- */
function logTimeline(logA, logB, delayA, delayB) {
  const tb = document.querySelector('#logTable tbody');
  tb.innerHTML = '';

  const len = Math.max(logA.length, logB.length);

  for (let i = 0; i < len; i++) {
    const a = logA[i] || [];
    const b = logB[i] || [];
    const t = a[0] || b[0];

    const row = document.createElement('tr');

    const isAStart = +t === +delayA;
    const isBStart = +t === +delayB;

    if (a[1] <= 0) a[1] = 0;
    if (b[1] <= 0) b[1] = 0;
    // convert used-skill name arrays (a[2], b[2]) into icon HTML
    const bSkillsHTML = skillIconsHTML(a[2], a[3]);
    const aSkillsHTML = skillIconsHTML(b[2], b[3]);

    row.innerHTML = `
      <td>${t}</td>
      <td class='${isAStart ? 'highlight' : ''}'>${a[1] ? pretty(+a[1]) : '☠️'}<div style="margin-top:6px">${aSkillsHTML}</div></td>
      <td class='${isBStart ? 'highlight' : ''}'>${b[1] ? pretty(+b[1]) : '☠️'}<div style="margin-top:6px">${bSkillsHTML}</div></td>
    `;

    tb.appendChild(row);
  }
}

function logTimeline2(battleResults) {
  const tb = document.querySelector('#logTable tbody');
  tb.innerHTML = '';

  for (const battleResult of battleResults) {
    const row = document.createElement('tr');

    // 남은 hp가 0 미만이면 0으로 변경
    if (battleResult.me.hp < 0) battleResult.me.hp = 0;
    if (battleResult.enemy.hp < 0) battleResult.enemy.hp = 0;

    // 해당 시점에 Sill이 사용된 경우 Skill Icon 추가
    const mySkillsHTML = skillIconsHTML(battleResult.me.skillUsed, battleResult.me.buffSkillUsed);
    const enemySkillsHTML = skillIconsHTML(battleResult.enemy.skillUsed, battleResult.enemy.buffSkillUsed);
    
    row.innerHTML = `
      <td>${battleResult.me.time}</td>
      <td class='highlight'>${battleResult.me.hp ? pretty(+battleResult.me.hp) : '☠️'}<div style="margin-top:6px">${mySkillsHTML}</div></td>
      <td class='highlight'>${battleResult.enemy.hp ? pretty(+battleResult.enemy.hp) : '☠️'}<div style="margin-top:6px">${enemySkillsHTML}</div></td>
    `;

    tb.appendChild(row);
  }
}

// 입력으로 받은 객체가 외부에서 재사용되는 참조일 수 있으므로,
// 내부에서 수정해도 원본에 영향이 가지 않도록 깊은 복사합니다.
const clone = (obj) => {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    // 구조화 불가한 값이 있는 경우 얕은 복사로 대체
    return Object.assign({}, obj);
  }
};