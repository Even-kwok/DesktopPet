import {
  createMockAccountDataState,
  type AccountDataState
} from "../account-data-state.ts";
import {
  currentUser,
  friends,
  hostingRequests,
  petAssets,
  pets,
  rechargeRecords,
  referralCodes,
  referralRewardLedger,
  referredUser,
  userReferrals
} from "../mock-data.ts";

export const mockAccountState = createMockAccountDataState(defaultMockAccountStateInput());

export function getMockAccountDataState() {
  return mockAccountState;
}

export function resetMockAccountDataStateForTests(state?: Partial<AccountDataState>) {
  const nextState = createMockAccountDataState(state ?? defaultMockAccountStateInput());

  mockAccountState.users = nextState.users;
  mockAccountState.pets = nextState.pets;
  mockAccountState.assets = nextState.assets;
  mockAccountState.generationJobs = nextState.generationJobs;
  mockAccountState.friends = nextState.friends;
  mockAccountState.hostingRequests = nextState.hostingRequests;
  mockAccountState.desktopEvents = nextState.desktopEvents;
  mockAccountState.referralCodes = nextState.referralCodes;
  mockAccountState.userReferrals = nextState.userReferrals;
  mockAccountState.referralRewardLedger = nextState.referralRewardLedger;
  mockAccountState.rechargeRecords = nextState.rechargeRecords;
}

function defaultMockAccountStateInput(): Partial<AccountDataState> {
  return {
    users: [currentUser, referredUser],
    pets,
    assets: petAssets,
    friends,
    hostingRequests,
    referralCodes,
    userReferrals,
    referralRewardLedger,
    rechargeRecords
  };
}
