const game = document.getElementById("game");
const player = document.getElementById("player");
const timeEl = document.getElementById("time");
const scoreEl = document.getElementById("score");

let playerX = (game.clientWidth - player.offsetWidth) / 2;
player.style.left = playerX + "px";

let moveLeft = false;
let moveRight = false;
let time = 0;
let score = 0;
let gameOver = false;
let isPaused = false;

// 레벨 시스템 변수
let playerLevel = 1;
let currentExp = 0;
let maxExp = 100;
let accuracyBonus = 0;
let scoreMultiplier = 1.0;
let shieldCharges = 0;
let isShielded = false;
let totalBoxesAvoided = 0;

// 사운드 시스템
let musicEnabled = true;
let sfxEnabled = true;
let audioContext;
let bgMusic, collisionSound, levelUpSound, shieldSound;

// Web Audio API를 사용한 사운드 생성
function initAudioSystem() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // 배경음악 생성 (8비트 스타일)
        bgMusic = createBackgroundMusic();

        // 효과음 생성
        collisionSound = createCollisionSound();
        levelUpSound = createLevelUpSound();
        shieldSound = createShieldSound();

    } catch (error) {
        console.log('Audio not supported');
    }
}

function createBackgroundMusic() {
    // 8비트 스타일 배경음악 생성
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]; // C4-C5
    const melody = [0, 2, 4, 2, 0, 2, 4, 2, 4, 5, 7, 4, 5, 7];
    let noteIndex = 0;
    let musicInterval;

    return {
        play: () => {
            if (!musicEnabled || !audioContext) return;

            musicInterval = setInterval(() => {
                const frequency = notes[melody[noteIndex % melody.length]];
                playTone(frequency, 0.3, 0.1);
                noteIndex++;
            }, 400);
        },
        stop: () => {
            if (musicInterval) {
                clearInterval(musicInterval);
            }
        }
    };
}

function createCollisionSound() {
    return () => {
        if (!sfxEnabled || !audioContext) return;

        // 충돌음: 낮은 주파수에서 높은 주파수로 빠르게 변화
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.type = 'sawtooth';
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    };
}

function createLevelUpSound() {
    return () => {
        if (!sfxEnabled || !audioContext) return;

        // 레벨업음: 상승하는 아르페지오
        const notes = [261.63, 329.63, 392.00, 523.25];
        notes.forEach((freq, index) => {
            setTimeout(() => {
                playTone(freq, 0.2, 0.15);
            }, index * 100);
        });
    };
}

function createShieldSound() {
    return () => {
        if (!sfxEnabled || !audioContext) return;

        // 실드음: 전자적인 소리
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.type = 'square';
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    };
}

function playTone(frequency, volume, duration) {
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.type = 'square';
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// 사운드 컨트롤 버튼 이벤트
function initSoundControls() {
    const pauseBtn = document.getElementById('pauseBtn');
    const musicBtn = document.getElementById('musicBtn');
    const sfxBtn = document.getElementById('sfxBtn');

    pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? '▶️' : '⏸️';
        
        if (isPaused) {
            if (bgMusic && musicEnabled) {
                bgMusic.stop();
            }
        } else {
            if (bgMusic && musicEnabled) {
                bgMusic.play();
            }
        }
    });

    musicBtn.addEventListener('click', () => {
        musicEnabled = !musicEnabled;
        musicBtn.classList.toggle('muted', !musicEnabled);
        musicBtn.textContent = musicEnabled ? '🎵' : '🔇';

        if (musicEnabled) {
            bgMusic.play();
        } else {
            bgMusic.stop();
        }
    });

    sfxBtn.addEventListener('click', () => {
        sfxEnabled = !sfxEnabled;
        sfxBtn.classList.toggle('muted', !sfxEnabled);
        sfxBtn.textContent = sfxEnabled ? '🔊' : '🔇';
    });
}

// 충돌 이펙트 생성
function createCollisionEffect(x, y) {
    // 메인 폭발 이펙트
    const explosion = document.createElement('div');
    explosion.className = 'collision-effect';
    explosion.style.left = (x - 50) + 'px';
    explosion.style.top = (y - 50) + 'px';
    game.appendChild(explosion);

    // 파티클 이펙트
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle-effect';

        const angle = (i / 12) * Math.PI * 2;
        const distance = 50 + Math.random() * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;

        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.setProperty('--dx', dx + 'px');
        particle.style.setProperty('--dy', dy + 'px');
        particle.style.background = ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b'][Math.floor(Math.random() * 5)];

        game.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 1000);
    }

    // 화면 흔들림 효과
    document.body.classList.add('screen-shake');
    setTimeout(() => {
        document.body.classList.remove('screen-shake');
    }, 500);

    setTimeout(() => {
        explosion.remove();
    }, 600);
}

// 레벨 시스템 함수들
function updateLevelDisplay() {
    document.getElementById('currentLevel').textContent = playerLevel;
    document.getElementById('level').textContent = playerLevel;
    document.getElementById('currentExp').textContent = currentExp;
    document.getElementById('maxExp').textContent = maxExp;
    document.getElementById('accuracyBonus').textContent = accuracyBonus;
    document.getElementById('scoreMultiplier').textContent = scoreMultiplier.toFixed(1);
    document.getElementById('shieldCharges').textContent = shieldCharges;

    // EXP 바 업데이트
    const expPercentage = (currentExp / maxExp) * 100;
    document.getElementById('expFill').style.width = expPercentage + '%';
}

function gainExp(amount) {
    currentExp += amount;

    // 레벨업 체크
    while (currentExp >= maxExp) {
        levelUp();
    }

    updateLevelDisplay();
}

function levelUp() {
    currentExp -= maxExp;
    playerLevel++;
    maxExp = Math.floor(maxExp * 1.5); // 다음 레벨 필요 경험치 증가

    // 레벨업 보너스 적용
    accuracyBonus += 5; // 정확도 보너스 5% 증가
    scoreMultiplier += 0.2; // 점수 배율 0.2 증가

    // 특정 레벨마다 실드 충전
    if (playerLevel % 3 === 0) {
        shieldCharges++;
    }

    // 레벨업 애니메이션
    const levelSystem = document.getElementById('levelSystem');
    levelSystem.classList.add('level-up');
    setTimeout(() => {
        levelSystem.classList.remove('level-up');
    }, 1000);

    // 레벨업 알림
    showLevelUpNotification();

    updateLevelDisplay();
}

function showLevelUpNotification() {
    // 레벨업 알림 생성
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(45deg, #ffd700, #ff8c00);
        color: #000;
        padding: 20px 30px;
        border: 4px solid #fff;
        border-radius: 15px;
        font-family: 'Press Start 2P', monospace;
        font-size: 16px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
        animation: levelUpNotification 3s ease-in-out forwards;
        `;
    notification.innerHTML = `
        ⭐ LEVEL UP! ⭐<br>
        <div style="font-size: 12px; margin-top: 10px;">
        Level ${playerLevel}<br>
        +5% Accuracy Bonus<br>
        +0.2x Score Multiplier
        ${playerLevel % 3 === 0 ? '<br>+1 Shield Charge!' : ''}
        </div>
        `;

    document.body.appendChild(notification);

    // 3초 후 제거
    setTimeout(() => {
        notification.remove();
    }, 3000);

    // 레벨업 애니메이션 CSS 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes levelUpNotification {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        20% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
        }
        `;
    document.head.appendChild(style);
}

function useShield() {
    if (shieldCharges > 0 && !isShielded) {
        shieldCharges--;
        isShielded = true;

        // 실드 시각 효과
        player.classList.add('player-shielded');

        // 5초 후 실드 해제
        setTimeout(() => {
            isShielded = false;
            player.classList.remove('player-shielded');
        }, 5000);

        updateLevelDisplay();

        // 실드 사용 알림
        showShieldNotification();
    }
}

function showShieldNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(45deg, #00ffff, #0080ff);
        color: #000;
        padding: 15px 25px;
        border: 3px solid #fff;
        border-radius: 10px;
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.8);
        animation: shieldNotification 2s ease-in-out forwards;
        `;
    notification.innerHTML = `🛡️ SHIELD ACTIVATED! 🛡️<br><div style="font-size: 10px; margin-top: 5px;">Protected for 5 seconds</div>`;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);

    // 실드 알림 애니메이션 CSS 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shieldNotification {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
        80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
        }
        `;
    document.head.appendChild(style);
}

// 키보드 이벤트에 실드 사용 추가
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") moveLeft = true;
    if (e.key === "ArrowRight") moveRight = true;
    if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        useShield();
    }
});

function loadRankings() {
    const rankings = localStorage.getItem('cottonCandyRankings');
    if (rankings) {
        return JSON.parse(rankings);
    }
    return [];
}

function saveRankings(rankings) {
    localStorage.setItem('cottonCandyRankings', JSON.stringify(rankings));
}

function updateRankingDisplay() {
    const rankings = loadRankings();
    const rankingItems = document.querySelectorAll('.rank-item');

    for (let i = 0; i < 10; i++) {
        const nameSpan = rankingItems[i].querySelector('.rank-name');
        const scoreSpan = rankingItems[i].querySelector('.rank-score');

        if (rankings[i]) {
            nameSpan.textContent = rankings[i].name;
            scoreSpan.textContent = rankings[i].score;
        } else {
            nameSpan.textContent = '---';
            scoreSpan.textContent = '0';
        }
    }
}

function addToRanking(playerName, playerScore) {
    let rankings = loadRankings();

    // 새 점수 추가
    rankings.push({ name: playerName, score: playerScore });

    // 점수 순으로 정렬 (내림차순)
    rankings.sort((a, b) => b.score - a.score);

    // 상위 10개만 유지
    rankings = rankings.slice(0, 10);

    saveRankings(rankings);
    updateRankingDisplay();

    // 순위 확인
    const rank = rankings.findIndex(r => r.name === playerName && r.score === playerScore) + 1;
    return rank <= 10 ? rank : null;
}

function isHighScore(playerScore) {
    const rankings = loadRankings();
    return rankings.length < 10 || playerScore > rankings[rankings.length - 1].score;
}

// 페이지 로드 시 랭킹 표시
updateRankingDisplay();
updateLevelDisplay();

// 모바일 터치 컨트롤 초기화
function initMobileControls() {
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const mobileShieldBtn = document.getElementById('shieldBtn');

    // 터치 버튼 컨트롤
    if (leftBtn) {
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            moveLeft = true;
        });
        leftBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            moveLeft = false;
        });
        leftBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            moveLeft = true;
        });
        leftBtn.addEventListener('mouseup', (e) => {
            e.preventDefault();
            moveLeft = false;
        });
    }

    if (rightBtn) {
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            moveRight = true;
        });
        rightBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            moveRight = false;
        });
        rightBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            moveRight = true;
        });
        rightBtn.addEventListener('mouseup', (e) => {
            e.preventDefault();
            moveRight = false;
        });
    }

    if (mobileShieldBtn) {
        mobileShieldBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            useShield();
        });
        mobileShieldBtn.addEventListener('click', (e) => {
            e.preventDefault();
            useShield();
        });
    }

    // 게임 영역 터치 컨트롤 (스와이프)
    let touchStartX = 0;
    let touchStartY = 0;

    game.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });

    game.addEventListener('touchend', (e) => {
        if (!touchStartX || !touchStartY) return;
        
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        
        // 최소 스와이프 거리
        const minSwipeDistance = 30;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            // 좌우 스와이프
            if (deltaX > 0) {
                // 오른쪽 스와이프
                moveRight = true;
                setTimeout(() => moveRight = false, 200);
            } else {
                // 왼쪽 스와이프
                moveLeft = true;
                setTimeout(() => moveLeft = false, 200);
            }
        } else if (Math.abs(deltaY) > minSwipeDistance) {
            // 상하 스와이프 - 실드 사용
            useShield();
        }
        
        touchStartX = 0;
        touchStartY = 0;
    });

    // 게임 영역 탭으로 실드 사용
    game.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // 두 손가락 탭으로 실드 사용
            e.preventDefault();
            useShield();
        }
    });
}

// 사운드 시스템 초기화
document.addEventListener('click', function initAudio() {
    initAudioSystem();
    initSoundControls();
    initMobileControls();

    // 배경음악 시작
    if (bgMusic && musicEnabled) {
        bgMusic.play();
    }

    // 한 번만 실행되도록 이벤트 리스너 제거
    document.removeEventListener('click', initAudio);
}, { once: true });

document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") moveLeft = true;
    if (e.key === "ArrowRight") moveRight = true;
    if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        useShield();
    }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        isPaused = !isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.textContent = isPaused ? '▶️' : '⏸️';
        
        if (isPaused) {
            if (bgMusic && musicEnabled) {
                bgMusic.stop();
            }
        } else {
            if (bgMusic && musicEnabled) {
                bgMusic.play();
            }
        }
    }
});

document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") moveLeft = false;
    if (e.key === "ArrowRight") moveRight = false;
});

function movePlayer() {
    if (moveLeft) playerX -= 5;
    if (moveRight) playerX += 5;

    const maxX = game.clientWidth - player.offsetWidth;
    playerX = Math.max(0, Math.min(maxX, playerX));
    player.style.left = playerX + "px";
}

setInterval(() => {
    if (!gameOver && !isPaused) movePlayer();
}, 16);

function createBox() {
    const box = document.createElement("div");
    box.classList.add("box");

    // Random size variations - adjust based on game area size
    const gameWidth = game.clientWidth;
    let sizes;
    
    if (gameWidth >= 550) {
        // iPad Mini dimensions - larger boxes
        sizes = [40, 45, 50, 55, 60];
    } else if (gameWidth >= 450) {
        // Tablet dimensions
        sizes = [35, 40, 45, 50, 55];
    } else {
        // Mobile dimensions
        sizes = [30, 35, 40, 45, 50];
    }
    
    const randomSize = sizes[Math.floor(Math.random() * sizes.length)];
    box.style.width = randomSize + "px";
    box.style.height = randomSize + "px";

    // Random shapes
    const shapes = ["square", "circle", "diamond", "triangle"];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];

    switch (randomShape) {
        case "circle":
            box.style.borderRadius = "50%";
            break;
        case "diamond":
            box.style.borderRadius = "0";
            box.style.transform = "rotate(45deg)";
            break;
        case "triangle":
            box.style.borderRadius = "0 0 50% 50%";
            box.style.transform = "rotate(" + Math.random() * 360 + "deg)";
            break;
        default: // square
            box.style.borderRadius = "8px";
    }

    // Random colors and patterns
    const patterns = [
        // Conic gradients
        "repeating-conic-gradient(from 0deg, #ff006e 0deg 45deg, #ffbe0b 45deg 90deg, #fb5607 90deg 135deg, #8338ec 135deg 180deg, #3a86ff 180deg 225deg, #06ffa5 225deg 270deg, #c77dff 270deg 315deg, #7209b7 315deg 360deg)",
        "repeating-conic-gradient(from 45deg, #ff9a8b 0deg 60deg, #a8e6cf 60deg 120deg, #ffd93d 120deg 180deg, #74b9ff 180deg 240deg, #fd79a8 240deg 300deg, #55a3ff 300deg 360deg)",

        // Linear gradients
        "repeating-linear-gradient(45deg, #ff006e 0px, #ff006e 5px, #ffbe0b 5px, #ffbe0b 10px, #fb5607 10px, #fb5607 15px, #8338ec 15px, #8338ec 20px)",
        "repeating-linear-gradient(90deg, #3a86ff 0px, #3a86ff 4px, #06ffa5 4px, #06ffa5 8px, #c77dff 8px, #c77dff 12px, #7209b7 12px, #7209b7 16px)",
        "repeating-linear-gradient(135deg, #ff9a8b 0px, #ff9a8b 6px, #a8e6cf 6px, #a8e6cf 12px, #ffd93d 12px, #ffd93d 18px)",

        // Radial gradients
        "radial-gradient(circle, #ff006e 20%, #8338ec 40%, #3a86ff 60%, #06ffa5 80%)",
        "radial-gradient(ellipse, #ffbe0b 10%, #fb5607 30%, #ff006e 50%, #c77dff 70%, #7209b7 90%)",

        // Solid colors with texture
        "linear-gradient(45deg, #ff006e 25%, transparent 25%), linear-gradient(-45deg, #8338ec 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3a86ff 75%), linear-gradient(-45deg, transparent 75%, #06ffa5 75%)",
        "repeating-linear-gradient(0deg, #ffbe0b, #ffbe0b 2px, #fb5607 2px, #fb5607 4px)",
        "repeating-linear-gradient(60deg, #c77dff, #c77dff 3px, #7209b7 3px, #7209b7 6px)"
    ];

    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
    box.style.background = randomPattern;

    // Random position
    const maxX = game.clientWidth - randomSize;
    box.style.left = Math.floor(Math.random() * maxX) + "px";

    // Random animation speed and style
    const animationTypes = ["spin", "wobble", "pulse", "shake"];
    const randomAnimation = animationTypes[Math.floor(Math.random() * animationTypes.length)];
    const animationSpeed = (Math.random() * 2 + 1) + "s"; // 1-3 seconds

    switch (randomAnimation) {
        case "wobble":
            box.style.animation = `boxPixelWobble ${animationSpeed} steps(6) infinite`;
            break;
        case "pulse":
            box.style.animation = `boxPixelPulse ${animationSpeed} steps(4) infinite`;
            break;
        case "shake":
            box.style.animation = `boxPixelShake ${animationSpeed} steps(8) infinite`;
            break;
        default:
            box.style.animation = `boxPixelSpin ${animationSpeed} steps(8) infinite`;
    }

    game.appendChild(box);

    let boxY = 0;
    // 시작부터 빠른 낙하 속도, 시간에 따라 더욱 증가
    let baseFallSpeed;
    if (time < 8) {
        baseFallSpeed = 2.5 + (time * 0.25); // 2.5에서 4.5로
    } else if (time < 16) {
        baseFallSpeed = 4.5 + ((time - 8) * 0.5); // 4.5에서 8.5로
    } else {
        baseFallSpeed = 8.5 + ((time - 16) * 0.3); // 8.5에서 계속 증가
    }

    // 랜덤 편차 추가 (±40%)
    const fallSpeed = baseFallSpeed + (Math.random() * baseFallSpeed * 0.8 - baseFallSpeed * 0.4);
    const finalFallSpeed = Math.max(2, fallSpeed); // 최소 2 보장

    const fall = setInterval(() => {
        if (gameOver) {
            clearInterval(fall);
            box.remove();
            return;
        }
        
        if (isPaused) return;

        boxY += finalFallSpeed;
        box.style.top = boxY + "px";

        const boxRect = box.getBoundingClientRect();
        const playerRect = player.getBoundingClientRect();

        if (
            boxRect.bottom >= playerRect.top &&
            boxRect.top <= playerRect.bottom &&
            boxRect.left < playerRect.right &&
            boxRect.right > playerRect.left
        ) {
            // 실드가 있으면 충돌 무시
            if (isShielded) {
                // 실드로 막은 경우 보너스 경험치
                gainExp(20);

                // 실드 이펙트 (작은 폭발)
                const playerRect = player.getBoundingClientRect();
                const gameRect = game.getBoundingClientRect();
                const effectX = playerRect.left - gameRect.left + playerRect.width / 2;
                const effectY = playerRect.top - gameRect.top + playerRect.height / 2;
                createCollisionEffect(effectX, effectY);

                box.remove();
                clearInterval(fall);
                return;
            }

            // 충돌 사운드 재생
            if (collisionSound) collisionSound();

            // 충돌 이펙트 생성
            const playerRect = player.getBoundingClientRect();
            const gameRect = game.getBoundingClientRect();
            const effectX = playerRect.left - gameRect.left + playerRect.width / 2;
            const effectY = playerRect.top - gameRect.top + playerRect.height / 2;
            createCollisionEffect(effectX, effectY);

            gameOver = true;

            // 배경음악 정지
            if (bgMusic) bgMusic.stop();

            // 하이스코어 체크
            if (isHighScore(score)) {
                const playerName = prompt("🎉 NEW HIGH SCORE! 🎉\n🌈 Your cotton candy survived " + time + " seconds!\n💎 Final Score: " + score + " (Level " + playerLevel + ")\n\n🏆 Enter your name for the leaderboard:");

                if (playerName && playerName.trim()) {
                    const rank = addToRanking(playerName.trim().substring(0, 12), score); // 이름 12자 제한
                    if (rank) {
                        alert("🏆 CONGRATULATIONS! 🏆\n🎮 You ranked #" + rank + " on the leaderboard!\n🍭 Player: " + playerName.trim() + "\n🌈 Score: " + score + "\n⏰ Time: " + time + "s\n⭐ Level: " + playerLevel);
                    }
                } else {
                    alert("🌈💥 PIXEL CRASH! Your cotton candy exploded into rainbow bits! 🍭✨\nFINAL SCORE: " + score + " 🎮\nTIME SURVIVED: " + time + "s\nLEVEL REACHED: " + playerLevel);
                }
            } else {
                alert("🌈💥 PIXEL CRASH! Your cotton candy exploded into rainbow bits! 🍭✨\nFINAL SCORE: " + score + " 🎮\nTIME SURVIVED: " + time + "s\nLEVEL REACHED: " + playerLevel + "\n\n🎯 Keep trying to reach the leaderboard!");
            }

            setTimeout(() => location.reload(), 1000);
        }

        if (boxY > 600) {
            // 박스를 성공적으로 피한 경우 경험치 획득
            totalBoxesAvoided++;
            gainExp(5 + Math.floor(playerLevel / 2)); // 레벨에 따라 경험치 증가
            box.remove();
            clearInterval(fall);
        }
    }, 20);
}

// 시간 & 점수 - 레벨 시스템과 연동된 점수 시스템
setInterval(() => {
    if (gameOver || isPaused) return;
    time++;

    // 시작부터 높은 점수, 시간에 따라 점수 증가율 상승
    let baseScoreIncrement;
    if (time < 5) {
        baseScoreIncrement = 20; // 시작부터 20점
    } else if (time < 10) {
        baseScoreIncrement = 30; // 30점
    } else if (time < 15) {
        baseScoreIncrement = 50; // 50점
    } else if (time < 20) {
        baseScoreIncrement = 80; // 80점
    } else {
        baseScoreIncrement = 120; // 최대 120점
    }

    // 레벨 배율 적용
    const finalScoreIncrement = Math.floor(baseScoreIncrement * scoreMultiplier);
    score += finalScoreIncrement;

    // 시간 생존 경험치
    gainExp(2);

    timeEl.textContent = time;
    scoreEl.textContent = score;
}, 1000);

// 박스 생성 - 시작부터 빠르게, 시간에 따라 더욱 급격히 빈번해짐
function scheduleNextBox() {
    if (gameOver) return;

    // 더 빠른 시작과 급격한 난이도 증가 곡선
    // 시작: 800ms, 5초 후: 400ms, 10초 후: 200ms, 15초 후: 100ms, 20초+ : 50ms
    let baseInterval;
    if (time < 5) {
        baseInterval = 800 - (time * 80); // 800ms에서 400ms로 (매초 80ms 감소)
    } else if (time < 10) {
        baseInterval = 400 - ((time - 5) * 40); // 400ms에서 200ms로 (매초 40ms 감소)
    } else if (time < 15) {
        baseInterval = 200 - ((time - 10) * 20); // 200ms에서 100ms로 (매초 20ms 감소)
    } else if (time < 20) {
        baseInterval = 100 - ((time - 15) * 10); // 100ms에서 50ms로 (매초 10ms 감소)
    } else {
        baseInterval = 50; // 최대 속도 (매우 빠름)
    }

    // 랜덤 편차 추가 (±25%)
    const randomVariation = baseInterval * 0.25;
    const randomInterval = baseInterval + (Math.random() * randomVariation * 2 - randomVariation);

    // 최소 30ms 보장 (너무 빠르지 않게)
    const finalInterval = Math.max(30, randomInterval);

    setTimeout(() => {
        if (!gameOver && !isPaused) {
            createBox();
            scheduleNextBox(); // 다음 박스 스케줄링
        } else if (!gameOver && isPaused) {
            // Game is paused, reschedule with same interval
            scheduleNextBox();
        }
    }, finalInterval);
}

// 첫 번째 박스 생성 시작
scheduleNextBox();