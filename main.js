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
let shieldCharges = 1;
let isShielded = false;
let totalBoxesAvoided = 0;

// Particle trail system
let particleTrails = [];
let lastPlayerX = playerX;
let lastPlayerY = 0;

// Difficulty system
let difficultyMode = "normal"; // easy, normal, hard, insane
let difficultyMultipliers = {
    easy: { spawn: 1.3, speed: 0.8, score: 0.9 },
    normal: { spawn: 1.0, speed: 1.1, score: 1.0 },
    hard: { spawn: 0.5, speed: 1.8, score: 2.2 },
    insane: { spawn: 0.25, speed: 2.5, score: 4.0 },
};

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
        console.log("Audio not supported");
    }
}

function createBackgroundMusic() {
    // 8비트 스타일 배경음악 생성
    const notes = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25]; // C4-C5
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
        },
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

        oscillator.type = "sawtooth";
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    };
}

function createLevelUpSound() {
    return () => {
        if (!sfxEnabled || !audioContext) return;

        // 레벨업음: 상승하는 아르페지오
        const notes = [261.63, 329.63, 392.0, 523.25];
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

        oscillator.type = "square";
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

    oscillator.type = "square";
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// 사운드 컨트롤 버튼 이벤트
function initSoundControls() {
    const pauseBtn = document.getElementById("pauseBtn");
    const musicBtn = document.getElementById("musicBtn");
    const sfxBtn = document.getElementById("sfxBtn");

    pauseBtn.addEventListener("click", () => {
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? "▶️" : "⏸️";

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

    musicBtn.addEventListener("click", () => {
        musicEnabled = !musicEnabled;
        musicBtn.classList.toggle("muted", !musicEnabled);
        musicBtn.textContent = musicEnabled ? "🎧" : "🔇";

        if (musicEnabled) {
            bgMusic.play();
        } else {
            bgMusic.stop();
        }
    });

    sfxBtn.addEventListener("click", () => {
        sfxEnabled = !sfxEnabled;
        sfxBtn.classList.toggle("muted", !sfxEnabled);
        sfxBtn.textContent = sfxEnabled ? "🔊" : "🔇";
    });
}

// 충돌 이펙트 생성
function createCollisionEffect(x, y) {
    // 메인 폭발 이펙트
    const explosion = document.createElement("div");
    explosion.className = "collision-effect";
    explosion.style.left = x - 50 + "px";
    explosion.style.top = y - 50 + "px";
    game.appendChild(explosion);

    // 파티클 이펙트
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement("div");
        particle.className = "particle-effect";

        const angle = (i / 12) * Math.PI * 2;
        const distance = 50 + Math.random() * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;

        particle.style.left = x + "px";
        particle.style.top = y + "px";
        particle.style.setProperty("--dx", dx + "px");
        particle.style.setProperty("--dy", dy + "px");
        particle.style.background = ["#ff006e", "#8338ec", "#3a86ff", "#06ffa5", "#ffbe0b"][
            Math.floor(Math.random() * 5)
        ];

        game.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 1000);
    }

    // 화면 흔들림 효과
    document.body.classList.add("screen-shake");
    setTimeout(() => {
        document.body.classList.remove("screen-shake");
    }, 500);

    setTimeout(() => {
        explosion.remove();
    }, 600);
}

// 레벨 시스템 함수들
function updateLevelDisplay() {
    document.getElementById("currentLevel").textContent = playerLevel;
    document.getElementById("level").textContent = playerLevel;
    document.getElementById("currentExp").textContent = currentExp;
    document.getElementById("maxExp").textContent = maxExp;
    document.getElementById("accuracyBonus").textContent = accuracyBonus;
    document.getElementById("scoreMultiplier").textContent = scoreMultiplier.toFixed(1);
    document.getElementById("shieldCharges").textContent = shieldCharges;

    // EXP 바 업데이트
    const expPercentage = (currentExp / maxExp) * 100;
    document.getElementById("expFill").style.width = expPercentage + "%";
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
    const levelSystem = document.getElementById("levelSystem");
    levelSystem.classList.add("level-up");
    setTimeout(() => {
        levelSystem.classList.remove("level-up");
    }, 1000);

    // 레벨업 알림
    showLevelUpNotification();

    updateLevelDisplay();
}

function showLevelUpNotification() {
    // 레벨업 알림 생성
    const notification = document.createElement("div");
    notification.style.cssText = `
        position: absolute;
        top: 15px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(45deg, #ffd700, #ff8c00);
        color: #000;
        padding: 10px 16px;
        border: 3px solid #fff;
        border-radius: 10px;
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        text-align: center;
        z-index: 1000;
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
        animation: levelUpNotification 1.2s ease-in-out forwards;
        max-width: 160px;
        font-weight: bold;
        `;
    notification.innerHTML = `⭐ LV ${playerLevel} ⭐`;

    game.appendChild(notification);

    // 1.2초 후 제거
    setTimeout(() => {
        notification.remove();
    }, 1200);

    // 레벨업 애니메이션 CSS 추가
    const style = document.createElement("style");
    style.textContent = `
        @keyframes levelUpNotification {
        0% { transform: translateX(-50%) translateY(-25px) scale(0.6); opacity: 0; }
        25% { transform: translateX(-50%) translateY(0) scale(1.2); opacity: 1; }
        75% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        100% { transform: translateX(-50%) translateY(-25px) scale(0.8); opacity: 0; }
        }
        `;
    document.head.appendChild(style);
}

function useShield() {
    if (shieldCharges > 0 && !isShielded) {
        shieldCharges--;
        isShielded = true;

        // 실드 사운드 재생
        if (shieldSound) shieldSound();

        // 실드 시각 효과
        player.classList.add("player-shielded");

        // 5초 후 실드 해제
        setTimeout(() => {
            isShielded = false;
            player.classList.remove("player-shielded");
        }, 5000);

        updateLevelDisplay();

        // 실드 사용 알림
        showShieldNotification();
    }
}

function showShieldNotification() {
    const notification = document.createElement("div");
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
        animation: shieldNotification 1s ease-in-out forwards;
        `;
    notification.innerHTML = `🛡️ SHIELD ACTIVATED! 🛡️<br><div style="font-size: 10px; margin-top: 5px;">Protected for 5 seconds</div>`;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 1000);

    // 실드 알림 애니메이션 CSS 추가
    const style = document.createElement("style");
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
    const rankings = localStorage.getItem("cottonCandyRankings");
    if (rankings) {
        return JSON.parse(rankings);
    }
    return [];
}

function saveRankings(rankings) {
    localStorage.setItem("cottonCandyRankings", JSON.stringify(rankings));
}

function updateRankingDisplay() {
    const rankings = loadRankings();
    const rankingItems = document.querySelectorAll(".rank-item");

    for (let i = 0; i < 10; i++) {
        const nameSpan = rankingItems[i].querySelector(".rank-name");
        const scoreSpan = rankingItems[i].querySelector(".rank-score");

        if (rankings[i]) {
            nameSpan.textContent = rankings[i].name;
            scoreSpan.textContent = rankings[i].score;
        } else {
            nameSpan.textContent = "---";
            scoreSpan.textContent = "0";
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
    const rank = rankings.findIndex((r) => r.name === playerName && r.score === playerScore) + 1;
    return rank <= 10 ? rank : null;
}

function isHighScore(playerScore) {
    const rankings = loadRankings();
    return rankings.length < 10 || playerScore > rankings[rankings.length - 1].score;
}

// 난이도 시스템 초기화
function initDifficultySystem() {
    const difficultyBtns = document.querySelectorAll(".difficulty-btn");
    const selectedDifficultySpan = document.getElementById("selectedDifficulty");
    const difficultyInfo = document.getElementById("difficultyInfo");

    // 기본값을 normal로 설정
    difficultyMode = "normal";
    updateDifficultyDisplay();

    difficultyBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (gameOver || !gameOver) {
                // 게임 중이 아닐 때만 변경 가능
                // 모든 버튼에서 active 클래스 제거
                difficultyBtns.forEach((b) => b.classList.remove("active"));

                // 클릭된 버튼에 active 클래스 추가
                btn.classList.add("active");

                // 난이도 모드 업데이트
                difficultyMode = btn.dataset.difficulty;
                updateDifficultyDisplay();
            }
        });
    });
}

function updateDifficultyDisplay() {
    const selectedDifficultySpan = document.getElementById("selectedDifficulty");
    const difficultyInfo = document.getElementById("difficultyInfo");
    const multiplier = difficultyMultipliers[difficultyMode];

    selectedDifficultySpan.textContent = difficultyMode.toUpperCase();

    const spawnText =
        multiplier.spawn > 1
            ? `+${Math.round((multiplier.spawn - 1) * 100)}%`
            : multiplier.spawn < 1
            ? `${Math.round((multiplier.spawn - 1) * 100)}%`
            : "0%";
    const speedText =
        multiplier.speed > 1
            ? `+${Math.round((multiplier.speed - 1) * 100)}%`
            : multiplier.speed < 1
            ? `${Math.round((multiplier.speed - 1) * 100)}%`
            : "0%";
    const scoreText =
        multiplier.score > 1
            ? `+${Math.round((multiplier.score - 1) * 100)}%`
            : multiplier.score < 1
            ? `${Math.round((multiplier.score - 1) * 100)}%`
            : "0%";

    difficultyInfo.innerHTML = `
        <div style="font-size: 8px; margin-top: 5px;">
            Selected: <span id="selectedDifficulty">${difficultyMode.toUpperCase()}</span><br>
            Spawn Rate: ${spawnText} | Speed: ${speedText} | Score: ${scoreText}
        </div>
    `;
}

// 페이지 로드 시 랭킹 표시
updateRankingDisplay();
updateLevelDisplay();
initDifficultySystem();

// 실시간 랭킹 업데이트 (5초마다)
setInterval(() => {
    updateRankingDisplay();
}, 5000);

// 모바일 터치 컨트롤 초기화
function initMobileControls() {
    const leftBtn = document.getElementById("leftBtn");
    const rightBtn = document.getElementById("rightBtn");
    const mobileShieldBtn = document.getElementById("shieldBtn");

    // 터치 버튼 컨트롤
    if (leftBtn) {
        leftBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            moveLeft = true;
        });
        leftBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            moveLeft = false;
        });
        leftBtn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            moveLeft = true;
        });
        leftBtn.addEventListener("mouseup", (e) => {
            e.preventDefault();
            moveLeft = false;
        });
    }

    if (rightBtn) {
        rightBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            moveRight = true;
        });
        rightBtn.addEventListener("touchend", (e) => {
            e.preventDefault();
            moveRight = false;
        });
        rightBtn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            moveRight = true;
        });
        rightBtn.addEventListener("mouseup", (e) => {
            e.preventDefault();
            moveRight = false;
        });
    }

    if (mobileShieldBtn) {
        mobileShieldBtn.addEventListener("touchstart", (e) => {
            e.preventDefault();
            useShield();
        });
        mobileShieldBtn.addEventListener("click", (e) => {
            e.preventDefault();
            useShield();
        });
    }

    // 게임 영역 터치 컨트롤 (스와이프)
    let touchStartX = 0;
    let touchStartY = 0;

    game.addEventListener("touchstart", (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });

    game.addEventListener("touchend", (e) => {
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
                setTimeout(() => (moveRight = false), 200);
            } else {
                // 왼쪽 스와이프
                moveLeft = true;
                setTimeout(() => (moveLeft = false), 200);
            }
        } else if (Math.abs(deltaY) > minSwipeDistance) {
            // 상하 스와이프 - 실드 사용
            useShield();
        }

        touchStartX = 0;
        touchStartY = 0;
    });

    // 게임 영역 탭으로 실드 사용
    game.addEventListener("touchstart", (e) => {
        if (e.touches.length === 2) {
            // 두 손가락 탭으로 실드 사용
            e.preventDefault();
            useShield();
        }
    });
}

// 사운드 시스템 초기화 - 자동 활성화
document.addEventListener(
    "click",
    function initAudio() {
        // 사운드 자동 활성화
        musicEnabled = true;
        sfxEnabled = true;

        initAudioSystem();
        initSoundControls();
        initMobileControls();

        // UI 버튼 상태 업데이트
        const musicBtn = document.getElementById("musicBtn");
        const sfxBtn = document.getElementById("sfxBtn");
        if (musicBtn) {
            musicBtn.textContent = "🎧";
            musicBtn.classList.remove("muted");
        }
        if (sfxBtn) {
            sfxBtn.textContent = "🔊";
            sfxBtn.classList.remove("muted");
        }

        // 배경음악 시작
        if (bgMusic && musicEnabled) {
            bgMusic.play();
        }

        // 한 번만 실행되도록 이벤트 리스너 제거
        document.removeEventListener("click", initAudio);
    },
    { once: true }
);

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
        const pauseBtn = document.getElementById("pauseBtn");
        pauseBtn.textContent = isPaused ? "▶️" : "⏸️";

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

// Particle trail creation
function createParticleTrail(x, y) {
    const particle = document.createElement("div");
    particle.className = "trail-particle";

    const colors = ["#ff006e", "#8338ec", "#3a86ff", "#06ffa5", "#ffbe0b", "#fb5607"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    particle.style.cssText = `
        position: absolute;
        width: 6px;
        height: 6px;
        background: ${randomColor};
        border-radius: 50%;
        left: ${x + 12}px;
        top: ${y + 12}px;
        pointer-events: none;
        z-index: 5;
        opacity: 0.8;
        box-shadow: 0 0 6px ${randomColor};
        animation: trailFade 0.5s ease-out forwards;
    `;

    game.appendChild(particle);

    // Remove particle after animation
    setTimeout(() => {
        if (particle.parentNode) {
            particle.remove();
        }
    }, 500);
}

function movePlayer() {
    if (moveLeft) playerX -= 5;
    if (moveRight) playerX += 5;

    const maxX = game.clientWidth - player.offsetWidth;
    playerX = Math.max(0, Math.min(maxX, playerX));
    player.style.left = playerX + "px";

    // Create particle trail when player moves
    const playerRect = player.getBoundingClientRect();
    const gameRect = game.getBoundingClientRect();
    const currentPlayerY = playerRect.top - gameRect.top;

    if (Math.abs(playerX - lastPlayerX) > 2) {
        createParticleTrail(lastPlayerX, currentPlayerY);
    }

    lastPlayerX = playerX;
    lastPlayerY = currentPlayerY;
}

setInterval(() => {
    if (!gameOver && !isPaused) movePlayer();
}, 16);

function createBox() {
    const box = document.createElement("div");
    box.classList.add("box");

    // Random chance for bouncing obstacle (30% chance)
    const isBouncing = Math.random() < 0.3;
    if (isBouncing) {
        box.classList.add("bouncing-box");
        box.dataset.bouncing = "true";
        // Random horizontal velocity for bouncing
        box.dataset.velocityX = (Math.random() - 0.5) * 6; // -3 to +3 horizontal speed
        box.dataset.bounces = "0"; // Track number of bounces
    }

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
        "repeating-linear-gradient(60deg, #c77dff, #c77dff 3px, #7209b7 3px, #7209b7 6px)",
    ];

    const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
    box.style.background = randomPattern;

    // Random position
    const maxX = game.clientWidth - randomSize;
    box.style.left = Math.floor(Math.random() * maxX) + "px";

    // Random animation speed and style
    const animationTypes = ["spin", "wobble", "pulse", "shake"];
    const randomAnimation = animationTypes[Math.floor(Math.random() * animationTypes.length)];
    const animationSpeed = Math.random() * 2 + 1 + "s"; // 1-3 seconds

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
    let boxX = parseFloat(box.style.left); // Get initial X position

    // 점진적인 낙하 속도 증가 + 난이도 배율 적용 (더 빠른 시작)
    let baseFallSpeed;
    if (time < 15) {
        baseFallSpeed = 3.5 + time * 0.25; // 3.5에서 7.25로 증가
    } else if (time < 30) {
        baseFallSpeed = 7.25 + (time - 15) * 0.3; // 7.25에서 11.75로 증가
    } else if (time < 60) {
        baseFallSpeed = 11.75 + (time - 30) * 0.2; // 11.75에서 17.75로 증가
    } else {
        baseFallSpeed = Math.min(20, 17.75 + (time - 60) * 0.1); // 최대 20로 제한
    }

    // 난이도 배율 적용
    baseFallSpeed = baseFallSpeed * difficultyMultipliers[difficultyMode].speed;

    // 랜덤 편차 추가 (±40%)
    const fallSpeed = baseFallSpeed + (Math.random() * baseFallSpeed * 0.8 - baseFallSpeed * 0.4);
    const finalFallSpeed = Math.max(2, fallSpeed); // 최소 2 보장

    // Bouncing physics variables
    let velocityX = box.dataset.bouncing === "true" ? parseFloat(box.dataset.velocityX) : 0;
    let bounces = parseInt(box.dataset.bounces) || 0;

    const fall = setInterval(() => {
        if (gameOver) {
            clearInterval(fall);
            box.remove();
            return;
        }

        if (isPaused) return;

        boxY += finalFallSpeed;

        // Handle bouncing physics
        if (box.dataset.bouncing === "true") {
            boxX += velocityX;

            // Wall collision detection and unpredictable bouncing
            const boxWidth = box.offsetWidth;
            const gameWidth = game.clientWidth;

            if (boxX <= 0 || boxX >= gameWidth - boxWidth) {
                // Bounce off walls with unpredictable behavior
                velocityX = -velocityX * (0.7 + Math.random() * 0.4); // Random bounce factor 0.7-1.1

                // Keep box within bounds
                boxX = Math.max(0, Math.min(gameWidth - boxWidth, boxX));

                // Increase bounce counter and add more chaos
                bounces++;
                if (bounces > 2) {
                    // After multiple bounces, add more unpredictability
                    velocityX += (Math.random() - 0.5) * 3;
                    velocityX = Math.max(-8, Math.min(8, velocityX)); // Limit max speed
                }
            }

            box.style.left = boxX + "px";
        }

        box.style.top = boxY + "px";

        const boxRect = box.getBoundingClientRect();
        const playerRect = player.getBoundingClientRect();

        // More precise collision detection - require significant overlap
        const overlapThreshold = 15; // Minimum overlap required for collision
        const horizontalOverlap =
            Math.min(boxRect.right, playerRect.right) - Math.max(boxRect.left, playerRect.left);
        const verticalOverlap =
            Math.min(boxRect.bottom, playerRect.bottom) - Math.max(boxRect.top, playerRect.top);

        if (horizontalOverlap > overlapThreshold && verticalOverlap > overlapThreshold) {
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
                const playerName = prompt(
                    "🎉 NEW HIGH SCORE! 🎉\n🌈 Your cotton candy survived " +
                        time +
                        " seconds!\n💎 Final Score: " +
                        score +
                        " (Level " +
                        playerLevel +
                        ")\n\n🏆 Enter your name for the leaderboard:"
                );

                if (playerName && playerName.trim()) {
                    const rank = addToRanking(playerName.trim().substring(0, 12), score); // 이름 12자 제한
                    if (rank) {
                        showGameOverWithShare(
                            "🏆 CONGRATULATIONS! 🏆\n🎮 You ranked #" +
                                rank +
                                " on the leaderboard!\n🍭 Player: " +
                                playerName.trim() +
                                "\n🌈 Score: " +
                                score +
                                "\n⏰ Time: " +
                                time +
                                "s\n⭐ Level: " +
                                playerLevel,
                            true
                        );
                    }
                } else {
                    showGameOverWithShare(
                        "🌈💥 PIXEL CRASH! Your cotton candy exploded into rainbow bits! 🍭✨\nFINAL SCORE: " +
                            score +
                            " 🎮\nTIME SURVIVED: " +
                            time +
                            "s\nLEVEL REACHED: " +
                            playerLevel,
                        false
                    );
                }
            } else {
                showGameOverWithShare(
                    "🌈💥 PIXEL CRASH! Your cotton candy exploded into rainbow bits! 🍭✨\nFINAL SCORE: " +
                        score +
                        " 🎮\nTIME SURVIVED: " +
                        time +
                        "s\nLEVEL REACHED: " +
                        playerLevel +
                        "\n\n🎯 Keep trying to reach the leaderboard!",
                    false
                );
            }
        }

        if (boxY > 600) {
            // 박스를 성공적으로 피한 경우 경험치 및 점수 획득
            totalBoxesAvoided++;

            // 난이도별 보상 시스템
            const difficultyMultiplier = difficultyMultipliers[difficultyMode];
            const baseAvoidScore = box.dataset.bouncing === "true" ? 15 : 10; // 바운싱 장애물은 더 높은 점수
            const avoidScore = Math.floor(
                baseAvoidScore * difficultyMultiplier.score * scoreMultiplier
            );

            // 점수 및 경험치 추가
            score += avoidScore;
            gainExp(5 + Math.floor(playerLevel / 2)); // 레벨에 따라 경험치 증가

            // 점수 표시 (선택적 - 작은 플로팅 텍스트)
            if (avoidScore >= 20) {
                showScorePopup(boxX + 20, boxY, `+${avoidScore}`);
            }

            // 지평선에 닿았을 때 스캐터링 이펙트 생성
            createScatterEffect(boxX + box.offsetWidth / 2, 600);

            box.remove();
            clearInterval(fall);
        }
    }, 20);
}

// 스캐터링 이펙트 생성 함수
function createScatterEffect(x, y) {
    // 8-12개의 작은 파편 생성
    const fragmentCount = 8 + Math.floor(Math.random() * 5);

    for (let i = 0; i < fragmentCount; i++) {
        const fragment = document.createElement("div");
        fragment.className = "scatter-fragment";

        // 랜덤 크기와 색상
        const size = 3 + Math.random() * 5; // 3-8px
        const colors = ["#ff006e", "#8338ec", "#3a86ff", "#06ffa5", "#ffbe0b", "#fb5607"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        // 랜덤 스캐터 방향과 속도
        const angle = (i / fragmentCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
        const velocity = 20 + Math.random() * 30; // 20-50px 거리
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity - Math.random() * 20; // 약간 위쪽으로도 튀게

        fragment.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: ${randomColor};
            left: ${x}px;
            top: ${y}px;
            border-radius: ${Math.random() > 0.5 ? "50%" : "20%"};
            pointer-events: none;
            z-index: 50;
            box-shadow: 0 0 4px ${randomColor};
            animation: scatterFragment 0.8s ease-out forwards;
        `;

        // CSS 변수로 애니메이션 방향 설정
        fragment.style.setProperty("--dx", dx + "px");
        fragment.style.setProperty("--dy", dy + "px");
        fragment.style.setProperty("--rotation", Math.random() * 720 - 360 + "deg");

        game.appendChild(fragment);

        // 파편 제거
        setTimeout(() => {
            if (fragment.parentNode) {
                fragment.remove();
            }
        }, 800);
    }

    // 바운스 이펙트 (중앙에서 퍼지는 원형 파동)
    const bounce = document.createElement("div");
    bounce.className = "scatter-bounce";
    bounce.style.cssText = `
        position: absolute;
        width: 20px;
        height: 20px;
        left: ${x - 10}px;
        top: ${y - 10}px;
        border: 2px solid #fff;
        border-radius: 50%;
        pointer-events: none;
        z-index: 60;
        animation: scatterBounce 0.6s ease-out forwards;
    `;

    game.appendChild(bounce);

    setTimeout(() => {
        if (bounce.parentNode) {
            bounce.remove();
        }
    }, 600);
}

// 점수 팝업 표시 함수
function showScorePopup(x, y, text) {
    const popup = document.createElement("div");
    popup.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        color: #06ffa5;
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        font-weight: bold;
        text-shadow: 1px 1px 0px #000, 0 0 8px #06ffa5;
        pointer-events: none;
        z-index: 100;
        animation: scorePopup 1s ease-out forwards;
    `;
    popup.textContent = text;
    game.appendChild(popup);

    setTimeout(() => {
        if (popup.parentNode) {
            popup.remove();
        }
    }, 1000);
}

// 시간 & 점수 - 레벨 시스템과 연동된 점수 시스템 (난이도별 보상 강화)
setInterval(() => {
    if (gameOver || isPaused) return;
    time++;

    // 난이도별 생존 시간 보너스 시스템
    let baseScoreIncrement;
    const difficultyBonus = {
        easy: 0.8,
        normal: 1.0,
        hard: 2.0, // 하드는 2배
        insane: 4.0, // 인세인은 4배!
    };

    if (time < 5) {
        baseScoreIncrement = 25; // 시작부터 25점
    } else if (time < 10) {
        baseScoreIncrement = 40; // 40점
    } else if (time < 15) {
        baseScoreIncrement = 60; // 60점
    } else if (time < 20) {
        baseScoreIncrement = 100; // 100점
    } else if (time < 30) {
        baseScoreIncrement = 150; // 150점
    } else {
        baseScoreIncrement = 200; // 최대 200점
    }

    // 레벨 배율, 난이도 배율, 그리고 특별 난이도 보너스 적용
    const finalScoreIncrement = Math.floor(
        baseScoreIncrement *
            scoreMultiplier *
            difficultyMultipliers[difficultyMode].score *
            difficultyBonus[difficultyMode]
    );

    score += finalScoreIncrement;

    // 시간 생존 경험치 (난이도별 차등)
    const baseExp = difficultyMode === "insane" ? 4 : difficultyMode === "hard" ? 3 : 2;
    gainExp(baseExp);

    timeEl.textContent = time;
    scoreEl.textContent = score;
}, 1000);

// 박스 생성 - 시작부터 빠르게, 시간에 따라 더욱 급격히 빈번해짐
function scheduleNextBox() {
    if (gameOver) return;

    // 보다 균형잡힌 난이도 증가 곡선 + 난이도 배율 적용 (더 빠른 시작)
    // 시작: 900ms, 8초 후: 600ms, 16초 후: 400ms, 25초 후: 250ms, 최대: 180ms
    let baseInterval;
    if (time < 8) {
        baseInterval = 900 - time * 37.5; // 900ms에서 600ms로 (매초 37.5ms 감소)
    } else if (time < 16) {
        baseInterval = 600 - (time - 8) * 25; // 600ms에서 400ms로 (매초 25ms 감소)
    } else if (time < 25) {
        baseInterval = 400 - (time - 16) * 16.67; // 400ms에서 250ms로 (매초 16.67ms 감소)
    } else if (time < 40) {
        baseInterval = 250 - (time - 25) * 4.67; // 250ms에서 180ms로 (천천히 감소)
    } else {
        baseInterval = 180; // 최대 속도 (빠르지만 생존 가능)
    }

    // 난이도 배율 적용
    baseInterval = baseInterval * difficultyMultipliers[difficultyMode].spawn;

    // 랜덤 편차 추가 (±25%)
    const randomVariation = baseInterval * 0.25;
    const randomInterval = baseInterval + (Math.random() * randomVariation * 2 - randomVariation);

    // 최소 150ms 보장 (생존 가능한 속도)
    const finalInterval = Math.max(150, randomInterval);

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

// SNS 공유 시스템
function initShareSystem() {
    const shareBtn = document.getElementById("shareBtn");
    const shareModal = document.getElementById("shareModal");
    const closeModal = document.getElementById("closeShareModal");

    if (shareBtn) {
        shareBtn.addEventListener("click", openShareModal);
    }

    if (closeModal) {
        closeModal.addEventListener("click", closeShareModal);
    }

    // 모달 배경 클릭시 닫기
    if (shareModal) {
        shareModal.addEventListener("click", (e) => {
            if (e.target === shareModal) {
                closeShareModal();
            }
        });
    }

    // 공유 버튼들 이벤트 리스너
    const shareButtons = {
        shareTwitter: shareToTwitter,
        shareInstagram: shareToInstagram,
        shareFacebook: shareToFacebook,
        shareThreads: shareToThreads,
        copyLink: copyShareMessage,
        copyGameLink: copyGameLinkOnly,
    };

    Object.entries(shareButtons).forEach(([id, handler]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener("click", handler);
        }
    });
}

function openShareModal() {
    const modal = document.getElementById("shareModal");
    if (modal) {
        // 현재 게임 상태 업데이트
        updateShareStats();
        modal.style.display = "flex";

        // 기본 공유 메시지 설정
        const shareText = document.getElementById("shareText");
        if (shareText) {
            shareText.value = generateShareMessage();
        }

        // 게임 링크 설정
        const gameLinkInput = document.getElementById("gameLink");
        if (gameLinkInput) {
            gameLinkInput.value = getGameUrl();
        }
    }
}

function closeShareModal() {
    const modal = document.getElementById("shareModal");
    if (modal) {
        modal.style.display = "none";
    }
}

function updateShareStats() {
    const elements = {
        shareScore: score.toLocaleString(),
        shareLevel: playerLevel,
        shareTime: time + "s",
        shareDifficulty: difficultyMode.charAt(0).toUpperCase() + difficultyMode.slice(1),
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

function generateShareMessage() {
    const difficultyEmoji = {
        easy: "🟢",
        normal: "🟡",
        hard: "🔴",
        insane: "💀",
    };

    const encouragingMessages = [
        "🍭 Just crushed Cotton Candy Dodge! Think you can beat my record?",
        "🌈 My cotton candy survived the pixel storm! Can yours do better?",
        "⭐ Level up your dodging skills and challenge me in Cotton Candy Dodge!",
        "🎮 This retro dodging game is addictive! Beat my score if you can!",
        "💎 Cotton candy champion here! Who dares to challenge my record?",
        "🏆 Pixel perfect dodging achieved! Your turn to prove your skills!",
        "🚀 Just set a new personal best! Come test your reflexes against mine!",
    ];

    const randomMessage =
        encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];

    return `${randomMessage}\n\n🌈 Score: ${score.toLocaleString()}\n⭐ Level: ${playerLevel}\n⏰ Time: ${time}s\n${
        difficultyEmoji[difficultyMode]
    } Difficulty: ${
        difficultyMode.charAt(0).toUpperCase() + difficultyMode.slice(1)
    }\n\n🎯 Play Cotton Candy Dodge and beat the record!`;
}

function getGameUrl() {
    return "https://jenna-studio.github.io/cotton-candy-dodge";
}

function getCustomMessage() {
    const shareText = document.getElementById("shareText");
    return shareText ? shareText.value : generateShareMessage();
}

function shareToTwitter() {
    const message = getCustomMessage();
    const url = getGameUrl();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        message
    )}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, "_blank", "width=600,height=400");
}

function shareToInstagram() {
    // Instagram doesn't support direct text sharing, so we copy the message and open Instagram
    copyToClipboard(getCustomMessage() + "\n\n" + getGameUrl());
    alert(
        "📷 Message copied to clipboard! Paste it in your Instagram post or story.\n\n💡 Tip: Take a screenshot of your score for the perfect Instagram post!"
    );
    window.open("https://www.instagram.com/", "_blank");
}

function shareToFacebook() {
    const message = getCustomMessage();
    const url = getGameUrl();
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        url
    )}&quote=${encodeURIComponent(message)}`;
    window.open(facebookUrl, "_blank", "width=600,height=400");
}

function shareToThreads() {
    const message = getCustomMessage();
    const url = getGameUrl();
    const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(
        message + "\n\n" + url
    )}`;
    window.open(threadsUrl, "_blank", "width=600,height=400");
}

function copyShareMessage() {
    const message = getCustomMessage() + "\n\n" + getGameUrl();
    copyToClipboard(message);

    // 성공 피드백
    const btn = document.getElementById("copyLink");
    const originalText = btn.innerHTML;
    btn.innerHTML = "<span>Copied!</span>";
    btn.style.background = "linear-gradient(45deg, #00d084, #06ffa5)";

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = "linear-gradient(45deg, #06ffa5, #00d084)";
    }, 2000);
}

function copyGameLinkOnly() {
    const gameUrl = getGameUrl();
    copyToClipboard(gameUrl);

    // 성공 피드백
    const btn = document.getElementById("copyGameLink");
    const originalText = btn.innerHTML;
    btn.innerHTML = "✅";
    btn.style.background = "linear-gradient(45deg, #00d084, #06ffa5)";

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = "linear-gradient(45deg, #06ffa5, #00d084)";
    }, 2000);
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
    }
}

// 첫 번째 박스 생성 시작
scheduleNextBox();

// 게임 오버 시 공유 기능이 포함된 모달 표시
// Function to enhance score text styling
function enhanceScoreText(message) {
    // Enhanced styling for score numbers - make them more prominent
    return message
        .replace(
            /Score: (\d+(?:,\d+)*)/g,
            'Score: <span style="' +
                "color: #ff006e; " +
                "font-size: 16px; " +
                "font-weight: bold; " +
                "text-shadow: " +
                "2px 2px 0px #000, " +
                "0 0 15px rgba(255, 0, 110, 0.8), " +
                "0 0 25px rgba(255, 0, 110, 0.6), " +
                "0 0 35px rgba(255, 0, 110, 0.4); " +
                "display: inline-block; " +
                "transform: scale(1.1); " +
                "padding: 2px 6px; " +
                "border-radius: 6px; " +
                "background: linear-gradient(135deg, rgba(255, 0, 110, 0.2), rgba(131, 56, 236, 0.2)); " +
                "border: 1px solid rgba(255, 0, 110, 0.3); " +
                "animation: scoreTextPulse 2s ease-in-out infinite alternate;" +
                '">$1</span>'
        )
        .replace(
            /Level (\d+)/g,
            'Level <span style="' +
                "color: #ffd700; " +
                "font-size: 15px; " +
                "font-weight: bold; " +
                "text-shadow: " +
                "1px 1px 0px #000, " +
                "0 0 10px rgba(255, 215, 0, 0.8); " +
                "display: inline-block; " +
                "transform: scale(1.05);" +
                '">$1</span>'
        )
        .replace(
            /(\d+) seconds/g,
            '<span style="' +
                "color: #06ffa5; " +
                "font-size: 14px; " +
                "font-weight: bold; " +
                "text-shadow: " +
                "1px 1px 0px #000, " +
                "0 0 8px rgba(6, 255, 165, 0.6); " +
                "display: inline-block;" +
                '">$1</span> seconds'
        );
}

function showGameOverWithShare(message, isHighScore) {
    // 게임 오버 모달 생성
    const gameOverModal = document.createElement("div");
    gameOverModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
        backdrop-filter: blur(10px);
    `;

    const modalContent = document.createElement("div");
    modalContent.style.cssText = `
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f1419 100%);
        border: 6px solid ${isHighScore ? "#ffd700" : "#fff"};
        border-radius: 20px;
        padding: 30px;
        max-width: 550px;
        width: 90%;
        box-shadow: 
            0 0 40px ${isHighScore ? "rgba(255, 215, 0, 0.9)" : "rgba(255, 0, 110, 0.8)"}, 
            inset 0 0 30px rgba(255, 255, 255, 0.1),
            0 20px 60px rgba(0, 0, 0, 0.5);
        font-family: 'Press Start 2P', monospace;
        color: #fff;
        text-align: center;
        animation: gameOverModalAnimation 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        position: relative;
        overflow: hidden;
    `;

    modalContent.innerHTML = `
        <!-- Decorative background pattern -->
        <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: repeating-linear-gradient(
                45deg,
                transparent 0px,
                transparent 10px,
                rgba(255, 255, 255, 0.02) 10px,
                rgba(255, 255, 255, 0.02) 20px
            );
            pointer-events: none;
        "></div>
        
        <!-- Main message with enhanced styling -->
        <div style="
            position: relative;
            margin-bottom: 25px; 
            font-size: 13px; 
            line-height: 2; 
            color: ${isHighScore ? "#ffd700" : "#fff"};
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 20px ${
                isHighScore ? "rgba(255, 215, 0, 0.3)" : "rgba(255, 0, 110, 0.3)"
            };
            padding: 20px;
            background: repeating-linear-gradient(
                90deg,
                rgba(255, 255, 255, 0.05) 0px,
                rgba(255, 255, 255, 0.05) 2px,
                transparent 2px,
                transparent 4px
            );
            border-radius: 15px;
            border: 2px solid rgba(255, 255, 255, 0.1);
        ">
            ${enhanceScoreText(message.replace(/\n/g, "<br>"))}
        </div>
        
        <!-- Enhanced game link section -->
        <div style="
            background: linear-gradient(135deg, rgba(6, 255, 165, 0.1), rgba(58, 134, 255, 0.1));
            border: 3px solid rgba(6, 255, 165, 0.4);
            border-radius: 15px;
            padding: 20px;
            margin: 25px 0;
            position: relative;
            overflow: hidden;
            animation: linkSectionGlow 2s ease-in-out infinite alternate;
        ">
            <div style="
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
                animation: shimmer 3s infinite;
            "></div>
            
            <div style="
                font-size: 12px; 
                color: #06ffa5; 
                margin-bottom: 12px;
                text-shadow: 0 0 10px rgba(6, 255, 165, 0.8);
                font-weight: bold;
            ">🎮 Challenge Your Friends!</div>
            
            <div style="display: flex; gap: 10px; align-items: center;">
                <div style="
                    background: linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.8));
                    border: 2px solid rgba(6, 255, 165, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                    font-size: 9px;
                    color: #06ffa5;
                    word-break: break-all;
                    font-family: 'Courier New', monospace;
                    text-shadow: 0 0 5px rgba(6, 255, 165, 0.5);
                    letter-spacing: 1px;
                    flex: 1;
                ">
                    https://jenna-studio.github.io/cotton-candy-dodge
                </div>
                
                <button id="copyGameLinkBtn" style="
                    background: linear-gradient(135deg, #ffd700 0%, #ff8c00 50%, #ff4500 100%);
                    border: 2px solid #fff;
                    border-radius: 8px;
                    color: #fff;
                    padding: 12px 15px;
                    font-family: 'Press Start 2P', monospace;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
                    box-shadow: 0 3px 10px rgba(255, 215, 0, 0.4);
                    min-width: 60px;
                ">📋</button>
            </div>
        </div>
        
        <!-- Enhanced action buttons -->
        <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
            <button id="gameOverShare" style="
                background: linear-gradient(135deg, #ff006e 0%, #8338ec 50%, #3a86ff 100%);
                border: 3px solid #fff;
                border-radius: 12px;
                color: #fff;
                padding: 15px 25px;
                font-family: 'Press Start 2P', monospace;
                font-size: 9px;
                cursor: pointer;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
                overflow: hidden;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
                box-shadow: 
                    0 5px 15px rgba(255, 0, 110, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
            ">🔗 Share Score</button>
            
            <button id="gameOverRestart" style="
                background: linear-gradient(135deg, #06ffa5 0%, #00d084 50%, #00b4d8 100%);
                border: 3px solid #fff;
                border-radius: 12px;
                color: #fff;
                padding: 15px 25px;
                font-family: 'Press Start 2P', monospace;
                font-size: 9px;
                cursor: pointer;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
                overflow: hidden;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
                box-shadow: 
                    0 5px 15px rgba(6, 255, 165, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
            ">🎮 Play Again</button>
        </div>
    `;

    gameOverModal.appendChild(modalContent);
    document.body.appendChild(gameOverModal);

    // 버튼 이벤트 리스너
    const shareBtn = modalContent.querySelector("#gameOverShare");
    const restartBtn = modalContent.querySelector("#gameOverRestart");
    const copyLinkBtn = modalContent.querySelector("#copyGameLinkBtn");

    shareBtn.addEventListener("click", () => {
        document.body.removeChild(gameOverModal);
        openShareModal();
    });

    restartBtn.addEventListener("click", () => {
        location.reload();
    });

    copyLinkBtn.addEventListener("click", async () => {
        const gameLink = "https://jenna-studio.github.io/cotton-candy-dodge";
        try {
            await navigator.clipboard.writeText(gameLink);
            // Visual feedback - temporarily change button text and style
            const originalHTML = copyLinkBtn.innerHTML;
            copyLinkBtn.innerHTML = "✅";
            copyLinkBtn.style.background =
                "linear-gradient(135deg, #06ffa5 0%, #00d084 50%, #00b4d8 100%)";
            copyLinkBtn.style.boxShadow = "0 3px 15px rgba(6, 255, 165, 0.8)";

            setTimeout(() => {
                copyLinkBtn.innerHTML = originalHTML;
                copyLinkBtn.style.background =
                    "linear-gradient(135deg, #ffd700 0%, #ff8c00 50%, #ff4500 100%)";
                copyLinkBtn.style.boxShadow = "0 3px 10px rgba(255, 215, 0, 0.4)";
            }, 1500);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = gameLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);

            copyLinkBtn.innerHTML = "✅";
            setTimeout(() => {
                copyLinkBtn.innerHTML = "📋";
            }, 1500);
        }
    });

    // Enhanced hover effects with ripple animation
    [shareBtn, restartBtn].forEach((btn, index) => {
        btn.addEventListener("mouseenter", () => {
            btn.style.transform = "scale(1.1) translateY(-2px)";
            if (index === 0) {
                // Share button
                btn.style.boxShadow = `
                    0 8px 25px rgba(255, 0, 110, 0.6),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3),
                    0 0 20px rgba(131, 56, 236, 0.4)
                `;
            } else {
                // Restart button
                btn.style.boxShadow = `
                    0 8px 25px rgba(6, 255, 165, 0.6),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3),
                    0 0 20px rgba(0, 180, 216, 0.4)
                `;
            }
        });

        btn.addEventListener("mouseleave", () => {
            btn.style.transform = "scale(1) translateY(0)";
            if (index === 0) {
                // Share button
                btn.style.boxShadow = `
                    0 5px 15px rgba(255, 0, 110, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2)
                `;
            } else {
                // Restart button
                btn.style.boxShadow = `
                    0 5px 15px rgba(6, 255, 165, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2)
                `;
            }
        });

        // Click effect
        btn.addEventListener("mousedown", () => {
            btn.style.transform = "scale(0.95) translateY(1px)";
        });

        btn.addEventListener("mouseup", () => {
            btn.style.transform = "scale(1.1) translateY(-2px)";
        });
    });

    // Copy button hover effects
    copyLinkBtn.addEventListener("mouseenter", () => {
        copyLinkBtn.style.transform = "scale(1.1)";
        copyLinkBtn.style.boxShadow = "0 5px 20px rgba(255, 215, 0, 0.8)";
    });

    copyLinkBtn.addEventListener("mouseleave", () => {
        copyLinkBtn.style.transform = "scale(1)";
        copyLinkBtn.style.boxShadow = "0 3px 10px rgba(255, 215, 0, 0.4)";
    });

    copyLinkBtn.addEventListener("mousedown", () => {
        copyLinkBtn.style.transform = "scale(0.95)";
    });

    copyLinkBtn.addEventListener("mouseup", () => {
        copyLinkBtn.style.transform = "scale(1.1)";
    });
}

// 공유 시스템 초기화
initShareSystem();
