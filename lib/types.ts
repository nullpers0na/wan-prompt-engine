export interface Persona {
  name: string;
  arcana: string;
  lvl: number;
  inherits: string;
  resists: string;
  stats: number[];
  skills: Record<string, number>;
}

export interface Skill {
  element: string;
  description: string;
}

export interface FusionRecipe {
  ingredients: Persona[];
  isSpecial: boolean;
}
