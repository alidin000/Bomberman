/* eslint-disable max-len */
/* eslint-disable no-shadow */
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

  private powerUps: Power[];

  private obstacles: number;

  private originalImage: string;

  private ghostImage: string;

  private invincibleImage: string;

  private currentImage: string;

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
    this.powerUps = powerUps;
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
      player.powerUps,
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
    const moveDistance = this.powerUps.includes('RollerSkate') ? 2 : 1;

    for (let i = 0; i < moveDistance; i += 1) {
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
    }
    return this;
  }

  addPowerUpMethod(powerUp: Power, addPowerUp: (powerUp: Power, duration: number) => void): void {
    switch (powerUp) {
      case 'AddBomb':
        this.bombs += 1;
        break;
      case 'BlastRangeUp':
        this.bombRange += 1;
        break;
      case 'Detonator':
        if (!this.powerUps.includes('Detonator')) {
          this.powerUps.push(powerUp);
        }
        break;
      case 'RollerSkate':
        if (!this.powerUps.includes('RollerSkate')) {
          this.powerUps.push(powerUp);
        }
        break;
      case 'Invincibility':
        this.powerUps.push(powerUp);
        addPowerUp('Invincibility', 15000);
        break;
      case 'Ghost':
        this.powerUps.push(powerUp);
        addPowerUp('Ghost', 15000);
        break;
      case 'Obstacle':
        this.obstacles += 3;
        this.powerUps.push(powerUp);
        break;
      case 'ClaySpider':
        this.bombs += 1;
        this.bombRange += 1;
        break;
      case 'Rasengan':
      case 'ChakraScroll':
        this.bombRange += 1;
        break;
      case 'Sharingan':
        if (!this.powerUps.includes('Detonator')) {
          this.powerUps.push('Detonator');
        }
        break;
      case 'FTGKunai':
        if (!this.powerUps.includes('RollerSkate')) {
          this.powerUps.push('RollerSkate');
        }
        break;
      case 'CrowFeather':
        this.powerUps.push('Ghost');
        addPowerUp('Ghost', 15000);
        break;
      case 'SandArmor':
        this.powerUps.push('Invincibility');
        addPowerUp('Invincibility', 15000);
        break;
      case 'CharacterFragment':
        break;
      default:
        console.log('Unknown power-up:', powerUp);
        break;
    }
    console.log(`${this.name} has picked up a ${powerUp} power-up.`);
  }

  checkCollisionWithPowerUp(map: GameMap, setMap: (m: GameMap) => void, addPowerUp: (powerUp: Power, duration: number) => void): void {
    const cell = map[this.y][this.x];
    if (isPower(cell)) {
      this.addPowerUpMethod(cell as Power, addPowerUp);
      const newMap = [...map];
      newMap[this.y][this.x] = 'Empty';
      setMap(newMap);
    }
  }

  isValidMove(
    y: number,
    x: number,
    map: GameMap,
    isPowerUpActive: (powerUp: Power) => boolean
  ): boolean {
    if (isPowerUpActive('Ghost')) {
      return !isObstacle(map[y][x]);
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
    const index = this.powerUps.indexOf(powerUp);
    if (index !== -1) {
      this.powerUps.splice(index, 1);
      console.log(`${this.name} has lost the ${powerUp} power-up.`);
      console.log(`player ${this.id} power-ups: ${this.powerUps}`);
    }
  }

  isDetonator(): boolean {
    return this.powerUps.includes('Detonator');
  }

  isInvincible(): boolean {
    return this.powerUps.includes('Invincibility');
  }

  isGhost(): boolean {
    return this.powerUps.includes('Ghost');
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
    return this.powerUps;
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
