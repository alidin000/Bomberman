/* eslint-disable default-param-last */
/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */
/* eslint-disable class-methods-use-this */
// eslint-disable-next-line import/no-cycle
import {
  GameMap, Power, isBomb, isObstacle, isPower
} from './gameItem';

class Player {
  private id: string;

  private name: string;

  private x: number;

  private y: number;

  private isActive: boolean;

  private bombs: number;

  private activeBombs: number; // Current active bombs

  private bombRange: number;

  private powerUps: Set<Power>;

  private obstacles: number;

  private originalImage: string;

  private ghostImage: string;

  private invincibleImage: string;

  private currentImage: string;

  private flashingInterval: NodeJS.Timeout | null = null;

  constructor(
    id: string,
    name: string,
    x: number,
    y: number,
    isActive: boolean = true,
    bombs: number = 1,
    bombRange: number = 2,
    powerUps: Power[] = [],
    obstacles: number = 0,
    originalImage: string,
    ghostImage: string,
    invincibleImage: string
  ) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.isActive = isActive;
    this.bombs = bombs;
    this.activeBombs = 0; // Initialize active bombs to 0
    this.bombRange = bombRange;
    this.powerUps = new Set(powerUps);
    this.obstacles = obstacles;
    this.originalImage = originalImage;
    this.ghostImage = ghostImage;
    this.invincibleImage = invincibleImage;
    this.currentImage = originalImage;
  }

  static fromPlayer(player: Player): Player {
    const newPlayer = new Player(
      player.id,
      player.name,
      player.x,
      player.y,
      player.isActive,
      player.bombs,
      player.bombRange,
      Array.from(player.powerUps),
      player.obstacles,
      player.originalImage,
      player.ghostImage,
      player.invincibleImage
    );
    newPlayer.activeBombs = player.activeBombs; // Copy active bombs
    return newPlayer;
  }

  move(
    direction: string,
    map: GameMap,
    otherPlayers: Player[],
    setMap: (m: GameMap) => void,
    addPowerUp: (powerUp: Power, duration: number) => void,
    removePowerUp: (powerUp: Power) => void,
    isPowerUpActive: (powerUp: Power) => boolean
  ): Player {
    let newX = this.x;
    let newY = this.y;

    switch (direction) {
      case 'up':
        newY -= this.y > 0 && this.isValidMove(newY - 1, this.x, map, isPowerUpActive) ? 1 : 0;
        break;
      case 'down':
        newY += this.y < map.length - 1
        && this.isValidMove(newY + 1, this.x, map, isPowerUpActive) ? 1 : 0;
        break;
      case 'left':
        newX -= this.x > 0 && this.isValidMove(this.y, newX - 1, map, isPowerUpActive) ? 1 : 0;
        break;
      case 'right':
        newX += (
          this.x < map[0].length - 1 && this.isValidMove(this.y, newX + 1, map, isPowerUpActive)
        ) ? 1 : 0;
        break;
      default:
        break;
    }

    const collidesWithPlayer = otherPlayers.some((p) => p.getX() === newX && p.getY() === newY);

    if (!collidesWithPlayer) {
      this.x = newX;
      this.y = newY;
      this.checkCollisionWithPowerUp(map, setMap, addPowerUp);
    }

    return this;
  }

  addPowerUp(powerUp: Power): void {
    switch (powerUp) {
      case 'AddBomb':
        this.bombs += 1;
        break;
      case 'BlastRangeUp':
        this.bombRange += 1;
        break;
      case 'RollerSkate':
        if (!this.powerUps.has('RollerSkate')) {
          this.powerUps.add(powerUp);
        }
        break;
      case 'Invincibility':
        if (!this.isInvincible()) {
          this.activatePowerUp('Invincibility', 15000);
        }
        break;
      case 'Ghost':
        if (!this.isGhost()) {
          this.activatePowerUp('Ghost', 15000);
        }
        break;
      case 'Obstacle':
        this.obstacles += 3;
        this.powerUps.add(powerUp);
        break;
      default:
        console.log('Unknown power-up:', powerUp);
        break;
    }
    console.log(`${this.name} has picked up a ${powerUp} power-up.`);
  }

  checkCollisionWithPowerUp(map: GameMap, setMap:
    (m: GameMap) => void, addPowerUp: (powerUp: Power, duration: number) => void): void {
    const cell = map[this.y][this.x];
    if (isPower(cell)) {
      this.addPowerUp(cell as Power);
      const newMap = [...map];
      newMap[this.y][this.x] = 'Empty';
      setMap(newMap);
      if (cell === 'Ghost') {
        addPowerUp('Ghost', 15000);
      } else if (cell === 'Invincibility') {
        addPowerUp('Invincibility', 15000);
      }
    }
  }

  isValidMove(
    y: number,
    x: number,
    map: GameMap,
    isPowerUpActive: (powerUp: Power) => boolean
  ): boolean {
    if (isPowerUpActive('Ghost')) {
      return !isObstacle(map[y][x]) && this.isInBounds(x, y);
    }
    return map[y][x] !== 'Wall' && map[y][x] !== 'Box' && !isObstacle(map[y][x]) && !isBomb(map[y][x]) && (map[y][x] === 'Empty' || isPower(map[y][x]));
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 1 && x < 14 && y >= 1 && y < 9;
  }

  killPlayer(): void {
    console.log(`${this.name} has been killed.`);
    this.isActive = false;
  }

  resetPosition(startX: number, startY: number): void {
    this.x = startX;
    this.y = startY;
    this.isActive = true;
  }

  canPlaceBomb(): boolean {
    return this.activeBombs < this.bombs;
  }

  incrementActiveBombs(): void {
    if (this.canPlaceBomb()) {
      this.activeBombs += 1;
    }
  }

  decrementActiveBombs(): void {
    if (this.activeBombs > 0) {
      this.activeBombs -= 1;
    }
  }

  removePowerUp(powerUp: Power): void {
    if (this.powerUps.has(powerUp)) {
      this.powerUps.delete(powerUp);
      console.log(`${this.name} has lost the ${powerUp} power-up.`);
      console.log(`player ${this.id} power-ups: ${Array.from(this.powerUps)}`);
    }
  }

  isDetonator(): boolean {
    return this.powerUps.has('Detonator');
  }

  isInvincible(): boolean {
    return this.powerUps.has('Invincibility');
  }

  isGhost(): boolean {
    return this.powerUps.has('Ghost');
  }

  activatePowerUp(powerUp: Power, duration: number): void {
    this.powerUps.add(powerUp);
    this.notifyPowerUp(powerUp, duration);
    this.updatePlayerImage(powerUp);
    setTimeout(() => {
      this.deactivatePowerUp(powerUp);
    }, duration);
  }

  deactivatePowerUp(powerUp: Power): void {
    this.powerUps.delete(powerUp);
    console.log(`${this.name} is no longer ${powerUp.toLowerCase()}.`);
    this.updatePlayerImage();
  }

  notifyPowerUp(powerUp: Power, duration: number): void {
    const durationInSeconds = duration / 1000;
    console.log(`${this.name} is now ${powerUp.toLowerCase()} for ${durationInSeconds} seconds.`);
    setTimeout(() => {
      console.log(`${this.name}'s ${powerUp.toLowerCase()} power-up will expire in 3 seconds.`);
      this.startFlashing();
    }, duration - 3000);
  }

  updatePlayerImage(powerUp?: Power): void {
    if (powerUp === 'Ghost') {
      this.currentImage = this.ghostImage;
    } else if (powerUp === 'Invincibility') {
      this.currentImage = this.invincibleImage;
    } else {
      this.currentImage = this.originalImage;
    }
  }

  startFlashing(): void {
    if (this.flashingInterval) {
      clearInterval(this.flashingInterval);
    }
    let isOriginalImage = false;
    this.flashingInterval = setInterval(() => {
      // eslint-disable-next-line no-nested-ternary
      this.currentImage = isOriginalImage ? this.originalImage
        : (this.isInvincible() ? this.invincibleImage : this.ghostImage);
      isOriginalImage = !isOriginalImage;
    }, 500);
    setTimeout(() => {
      clearInterval(this.flashingInterval as NodeJS.Timeout);
      this.flashingInterval = null;
      this.updatePlayerImage(); // Reset to the appropriate image
    }, 3000);
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getX(): number {
    return this.x;
  }

  getY(): number {
    return this.y;
  }

  getBombs(): number {
    return this.bombs;
  }

  getBombRange(): number {
    return this.bombRange;
  }

  getPowerUps(): Power[] {
    return Array.from(this.powerUps);
  }

  getObstacles(): number {
    return this.obstacles;
  }

  isAlive(): boolean {
    return this.isActive;
  }

  getImg(): string {
    return this.currentImage;
  }
}

export { Player };
