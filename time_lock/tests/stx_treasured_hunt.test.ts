import { describe, expect, it } from "vitest";

// Mock blockchain and contract state
const createMockState = () => {
  return {
    blockchain: {
      balances: {
        'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM': 100000, // Admin
        'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5': 10000,  // Player 1
        'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG': 10000,  // Player 2
        'CONTRACT': 0 // Contract balance
      }
    },
    contract: {
      admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      huntActive: false,
      totalStages: 0,
      totalReward: 0,
      currentBlockHeight: 0,
      stages: {},
      playerProgress: {},
      stageSolvers: {}
    }
  };
};

// Mock contract functions
const createContractFunctions = (state) => {
  return {
    // Admin functions
    initializeHunt(sender, stagesCount, totalReward, startingBlockHeight) {
      if (sender !== state.contract.admin) {
        return { error: 'ERR-NOT-AUTHORIZED' };
      }
      
      if (state.blockchain.balances[sender] < totalReward) {
        return { error: 'ERR-INSUFFICIENT-FUNDS' };
      }
      
      state.contract.huntActive = true;
      state.contract.totalStages = stagesCount;
      state.contract.totalReward = totalReward;
      state.contract.currentBlockHeight = startingBlockHeight;
      
      // Transfer funds to contract
      state.blockchain.balances[sender] -= totalReward;
      state.blockchain.balances['CONTRACT'] += totalReward;
      
      return { success: true };
    },
    
    updateBlockHeight(sender, newHeight) {
      if (sender !== state.contract.admin) {
        return { error: 'ERR-NOT-AUTHORIZED' };
      }
      
      state.contract.currentBlockHeight = newHeight;
      return { success: true };
    },
    
    addStage(sender, stageId, clue, answer, reward, timeLock) {
      if (sender !== state.contract.admin) {
        return { error: 'ERR-NOT-AUTHORIZED' };
      }
      
      if (state.contract.stages[stageId]) {
        return { error: 'ERR-STAGE-EXISTS' };
      }
      
      state.contract.stages[stageId] = {
        clue,
        answer,
        reward,
        timeLock,
        solved: false
      };
      
      state.contract.stageSolvers[stageId] = {
        solvers: []
      };
      
      return { success: true };
    },
    
    endHunt(sender) {
      if (sender !== state.contract.admin) {
        return { error: 'ERR-NOT-AUTHORIZED' };
      }
      
      state.contract.huntActive = false;
      
      // Return remaining funds to admin
      const remainingBalance = state.blockchain.balances['CONTRACT'];
      state.blockchain.balances['CONTRACT'] = 0;
      state.blockchain.balances[state.contract.admin] += remainingBalance;
      
      return { success: true };
    },
    
    // Player functions
    registerForHunt(sender) {
      if (!state.contract.huntActive) {
        return { error: 'ERR-HUNT-NOT-ACTIVE' };
      }
      
      state.contract.playerProgress[sender] = {
        currentStage: 1
      };
      
      return { success: true };
    },
    
    getCurrentClue(sender) {
      if (!state.contract.huntActive) {
        return { error: 'ERR-HUNT-NOT-ACTIVE' };
      }
      
      const playerData = state.contract.playerProgress[sender];
      if (!playerData) {
        return { error: 'ERR-NOT-AUTHORIZED' };
      }
      
      const currentStage = playerData.currentStage;
      if (currentStage > state.contract.totalStages) {
        return { error: 'ERR-STAGE-NOT-FOUND' };
      }
      
      const stageData = state.contract.stages[currentStage];
      if (!stageData) {
        return { error: 'ERR-STAGE-NOT-FOUND' };
      }
      
      // Check if the clue is time-locked
      if (stageData.timeLock > state.contract.currentBlockHeight) {
        return { error: 'ERR-TIME-LOCKED' };
      }
      
      return { success: true, result: stageData.clue };
    },
    
    submitAnswer(sender, answer) {
      if (!state.contract.huntActive) {
        return { error: 'ERR-HUNT-NOT-ACTIVE' };
      }
      
      const playerData = state.contract.playerProgress[sender];
      if (!playerData) {
        return { error: 'ERR-NOT-AUTHORIZED' };
      }
      
      const currentStage = playerData.currentStage;
      if (currentStage > state.contract.totalStages) {
        return { error: 'ERR-STAGE-NOT-FOUND' };
      }
      
      const stageData = state.contract.stages[currentStage];
      if (!stageData) {
        return { error: 'ERR-STAGE-NOT-FOUND' };
      }
      
      // Check if the clue is time-locked
      if (stageData.timeLock > state.contract.currentBlockHeight) {
        return { error: 'ERR-TIME-LOCKED' };
      }
      
      // Check if the answer is correct
      if (stageData.answer !== answer) {
        return { error: 'ERR-INCORRECT-ANSWER' };
      }
      
      // Award the reward
      state.blockchain.balances['CONTRACT'] -= stageData.reward;
      state.blockchain.balances[sender] += stageData.reward;
      
      // Update player progress to the next stage
      if (currentStage < state.contract.totalStages) {
        state.contract.playerProgress[sender].currentStage = currentStage + 1;
      }
      
      // Add player to solvers list if not already solved
      if (!stageData.solved) {
        state.contract.stages[currentStage].solved = true;
        state.contract.stageSolvers[currentStage].solvers.push(sender);
      }
      
      return { success: true };
    },
    
    // Read-only functions
    getHuntStatus() {
      return {
        active: state.contract.huntActive,
        totalStages: state.contract.totalStages,
        totalReward: state.contract.totalReward,
        currentBlockHeight: state.contract.currentBlockHeight
      };
    },
    
    getPlayerProgress(player) {
      return state.contract.playerProgress[player] || { currentStage: 0 };
    },
    
    getStageSolvers(stageId) {
      return state.contract.stageSolvers[stageId] || { solvers: [] };
    },
    
    isStageTimeLocked(stageId) {
      const stageData = state.contract.stages[stageId];
      if (!stageData) {
        return false;
      }
      
      return stageData.timeLock > state.contract.currentBlockHeight;
    },
    
    getAdmin() {
      return state.contract.admin;
    },
    
    setAdmin(sender, newAdmin) {
      if (sender !== state.contract.admin) {
        return { error: 'ERR-NOT-AUTHORIZED' };
      }
      
      state.contract.admin = newAdmin;
      return { success: true };
    }
  };
};

describe('Time-locked Treasure Hunt Contract', () => {
  it('should initialize a hunt', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    const stagesCount = 3;
    const totalReward = 5000;
    const startingBlockHeight = 100;
    
    const result = contract.initializeHunt(admin, stagesCount, totalReward, startingBlockHeight);
    
    expect(result.success).toBe(true);
    expect(state.contract.huntActive).toBe(true);
    expect(state.contract.totalStages).toBe(stagesCount);
    expect(state.contract.totalReward).toBe(totalReward);
    expect(state.contract.currentBlockHeight).toBe(startingBlockHeight);
    expect(state.blockchain.balances[admin]).toBe(95000); // 100000 - 5000
    expect(state.blockchain.balances['CONTRACT']).toBe(5000);
  });

  it('should not initialize a hunt if sender is not admin', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const nonAdmin = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const stagesCount = 3;
    const totalReward = 5000;
    const startingBlockHeight = 100;
    
    const result = contract.initializeHunt(nonAdmin, stagesCount, totalReward, startingBlockHeight);
    
    expect(result.error).toBe('ERR-NOT-AUTHORIZED');
    expect(state.contract.huntActive).toBe(false);
  });

  it('should add a stage to the hunt', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    
    // First initialize the hunt
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Then add a stage
    const stageId = 1;
    const clue = "What has keys but no locks, space but no room, and you can enter but not go in?";
    const answer = "keyboard";
    const reward = 1000;
    const timeLock = 110; // Future block height
    
    const result = contract.addStage(admin, stageId, clue, answer, reward, timeLock);
    
    expect(result.success).toBe(true);
    expect(state.contract.stages[stageId]).toBeDefined();
    expect(state.contract.stages[stageId].clue).toBe(clue);
    expect(state.contract.stages[stageId].answer).toBe(answer);
    expect(state.contract.stages[stageId].reward).toBe(reward);
    expect(state.contract.stages[stageId].timeLock).toBe(timeLock);
    expect(state.contract.stages[stageId].solved).toBe(false);
  });

  it('should not add a stage if it already exists', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    
    // First initialize the hunt
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Add a stage
    const stageId = 1;
    contract.addStage(admin, stageId, "Clue 1", "answer1", 1000, 110);
    
    // Try to add the same stage again
    const result = contract.addStage(admin, stageId, "Clue 1 again", "answer1", 1000, 110);
    
    expect(result.error).toBe('ERR-STAGE-EXISTS');
  });

  it('should register a player for the hunt', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    const player = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    
    // First initialize the hunt
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Then register a player
    const result = contract.registerForHunt(player);
    
    expect(result.success).toBe(true);
    expect(state.contract.playerProgress[player]).toBeDefined();
    expect(state.contract.playerProgress[player].currentStage).toBe(1);
  });

  it('should not register a player if hunt is not active', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const player = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    
    // Hunt is not initialized yet
    const result = contract.registerForHunt(player);
    
    expect(result.error).toBe('ERR-HUNT-NOT-ACTIVE');
    expect(state.contract.playerProgress[player]).toBeUndefined();
  });

  it('should get the current clue for a player', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    const player = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    
    // Initialize the hunt with block height 100
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Add a stage with a time lock in the past
    const stageId = 1;
    const clue = "What has keys but no locks, space but no room, and you can enter but not go in?";
    const timeLock = 90; // Past block height
    contract.addStage(admin, stageId, clue, "keyboard", 1000, timeLock);
    
    // Register a player
    contract.registerForHunt(player);
    
    // Get the current clue
    const result = contract.getCurrentClue(player);
    
    expect(result.success).toBe(true);
    expect(result.result).toBe(clue);
  });

  it('should not get the clue if it is time-locked', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    const player = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    
    // Initialize the hunt with block height 100
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Add a stage with a time lock in the future
    const stageId = 1;
    const timeLock = 110; // Future block height
    contract.addStage(admin, stageId, "Clue 1", "answer1", 1000, timeLock);
    
    // Register a player
    contract.registerForHunt(player);
    
    // Try to get the current clue
    const result = contract.getCurrentClue(player);
    
    expect(result.error).toBe('ERR-TIME-LOCKED');
  });

  it('should submit a correct answer and progress to the next stage', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    const player = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    
    // Initialize the hunt with block height 100
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Add two stages
    contract.addStage(admin, 1, "Clue 1", "keyboard", 1000, 90);
    contract.addStage(admin, 2, "Clue 2", "mountain", 2000, 90);
    
    // Register a player
    contract.registerForHunt(player);
    
    // Initial balance
    const initialBalance = state.blockchain.balances[player];
    
    // Submit the correct answer for stage 1
    const result = contract.submitAnswer(player, "keyboard");
    
    expect(result.success).toBe(true);
    expect(state.contract.playerProgress[player].currentStage).toBe(2); // Progressed to stage 2
    expect(state.blockchain.balances[player]).toBe(initialBalance + 1000); // Received reward
    expect(state.contract.stages[1].solved).toBe(true);
    expect(state.contract.stageSolvers[1].solvers).toContain(player);
  });

  it('should not submit an answer if it is incorrect', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    const player = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    
    // Initialize the hunt with block height 100
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Add a stage
    contract.addStage(admin, 1, "Clue 1", "keyboard", 1000, 90);
    
    // Register a player
    contract.registerForHunt(player);
    
    // Initial balance and stage
    const initialBalance = state.blockchain.balances[player];
    const initialStage = state.contract.playerProgress[player].currentStage;
    
    // Submit an incorrect answer
    const result = contract.submitAnswer(player, "wrong-answer");
    
    expect(result.error).toBe('ERR-INCORRECT-ANSWER');
    expect(state.contract.playerProgress[player].currentStage).toBe(initialStage); // Stage didn't change
    expect(state.blockchain.balances[player]).toBe(initialBalance); // No reward
    expect(state.contract.stages[1].solved).toBe(false);
    expect(state.contract.stageSolvers[1].solvers).not.toContain(player);
  });

  it('should end the hunt and return remaining funds to admin', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    
    // Initialize the hunt
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Initial admin balance after initialization
    const initialAdminBalance = state.blockchain.balances[admin];
    
    // End the hunt
    const result = contract.endHunt(admin);
    
    expect(result.success).toBe(true);
    expect(state.contract.huntActive).toBe(false);
    expect(state.blockchain.balances[admin]).toBe(initialAdminBalance + 5000); // Got funds back
    expect(state.blockchain.balances['CONTRACT']).toBe(0);
  });

  it('should unlock time-locked clues when block height advances', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    const player = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    
    // Initialize the hunt with block height 100
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Add a stage with a time lock in the future
    const stageId = 1;
    const timeLock = 110; // Future block height
    contract.addStage(admin, stageId, "Clue 1", "answer1", 1000, timeLock);
    
    // Register a player
    contract.registerForHunt(player);
    
    // Try to get the current clue (should be time-locked)
    let result = contract.getCurrentClue(player);
    expect(result.error).toBe('ERR-TIME-LOCKED');
    
    // Advance block height
    contract.updateBlockHeight(admin, 120);
    
    // Try to get the current clue again (should be unlocked)
    result = contract.getCurrentClue(player);
    expect(result.success).toBe(true);
    expect(result.result).toBe("Clue 1");
  });

  it('should check if a stage is time-locked', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    
    // Initialize the hunt with block height 100
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Add stages with different time locks
    contract.addStage(admin, 1, "Clue 1", "answer1", 1000, 90); // Past
    contract.addStage(admin, 2, "Clue 2", "answer2", 2000, 110); // Future
    
    // Check if stages are time-locked
    let isStage1Locked = contract.isStageTimeLocked(1);
    let isStage2Locked = contract.isStageTimeLocked(2);
    
    expect(isStage1Locked).toBe(false); // Stage 1 is not time-locked
    expect(isStage2Locked).toBe(true);  // Stage 2 is time-locked
    
    // Advance block height
    contract.updateBlockHeight(admin, 120);
    
    // Check again
    isStage2Locked = contract.isStageTimeLocked(2);
    expect(isStage2Locked).toBe(false); // Stage 2 is now unlocked
  });

  it('should allow multiple players to participate in the hunt', () => {
    const state = createMockState();
    const contract = createContractFunctions(state);
    
    const admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    const player1 = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';
    const player2 = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // Initialize the hunt with block height 100
    contract.initializeHunt(admin, 3, 5000, 100);
    
    // Add stages
    contract.addStage(admin, 1, "Clue 1", "answer1", 1000, 90);
    contract.addStage(admin, 2, "Clue 2", "answer2", 2000, 90);
    
    // Register players
    contract.registerForHunt(player1);
    contract.registerForHunt(player2);
    
    // Player 1 solves stage 1
    contract.submitAnswer(player1, "answer1");
    
    // Player 2 solves stage 1
    contract.submitAnswer(player2, "answer1");
    
    // Check progress
    expect(state.contract.playerProgress[player1].currentStage).toBe(2);
    expect(state.contract.playerProgress[player2].currentStage).toBe(2);
    expect(state.contract.stageSolvers[1].solvers).toContain(player1);
    expect(state.contract.stageSolvers[1].solvers).toContain(player2);
    
    // Player 1 solves stage 2
    contract.submitAnswer(player1, "answer2");
    
    // Check final progress
    expect(state.contract.playerProgress[player1].currentStage).toBe(3);
    expect(state.contract.playerProgress[player2].currentStage).toBe(2); // Still at stage 2
    expect(state.contract.stageSolvers[2].solvers).toContain(player1);
    expect(state.contract.stageSolvers[2].solvers).not.toContain(player2);
  });
});