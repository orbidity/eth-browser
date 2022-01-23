// Declare global types imported by importScripts()
import type Web3Type from "web3";
import type { AbiItem } from "web3-utils";
// @ts-expect-error solc doesn't have type definitions
import wrapper from "solc/wrapper";
import { Buffer } from "buffer";

declare const Ganache: any;
declare const Web3: typeof Web3Type;

interface SolidarityCompilation {
  errors?: { severity: "error" | "warning"; formattedMessage: string }[];
  contracts: {
    [source: string]: {
      [name: string]: {
        abi: AbiItem[] | AbiItem;
        evm: { bytecode: { object: string } };
      };
    };
  };
}

interface SolidarityContract {
  abi: AbiItem[] | AbiItem;
  bytecode: string;
}

type SolidarityContracts<Name extends string = string> = {
  [name in Name]: SolidarityContract;
};

// Import the Solidity compiler, Ethereum simulator and Web3 helper library
(self as any).window = self; // Required by web3.js
(self as any).Buffer = Buffer; // Required by ganache
importScripts(
  // "https://solc-bin.ethereum.org/bin/soljson-latest.js",
  "https://solc-bin.ethereum.org/bin/soljson-v0.8.11+commit.d7f03943.js",
  "https://cdn.jsdelivr.net/npm/ganache@7.0.0/dist/web/ganache.min.js",
  "https://cdn.jsdelivr.net/npm/web3@1.7.0/dist/web3.min.js"
);
const solc = wrapper((self as any).Module);

// Create new local Ethereum simulator
const provider = Ganache.provider({ gasLimit: 100000000 });
const web3 = new Web3(provider);

async function compileContracts<Name extends string = string>(
  code: string,
  imports?: Record<string, string>
): Promise<SolidarityContracts<Name>> {
  // Compile Solidity source code
  const source = "input.sol";
  const input = {
    language: "Solidity",
    sources: {
      [source]: { content: code },
    },
    settings: {
      outputSelection: { "*": { "*": ["*"] } },
    },
  };
  const output: SolidarityCompilation = JSON.parse(
    solc.compile(JSON.stringify(input), {
      import(path: string) {
        return imports?.[path]
          ? { contents: imports[path] }
          : { error: "File not found" };
      },
    })
  );
  output.errors = output.errors?.filter((error) => {
    if (error.severity === "warning") {
      console.warn(error.formattedMessage);
      return false;
    }
    return true;
  });
  if (output.errors?.length) {
    const messages = output.errors.map((error) => error.formattedMessage);
    throw new SyntaxError(`\n${messages.join("\n")}`);
  }

  // Extract compiled contracts
  const entries = Object.entries(output.contracts[source]).map<
    [string, SolidarityContract]
  >(([name, contract]) => [
    name,
    { abi: contract.abi, bytecode: contract.evm.bytecode.object },
  ]);
  return Object.fromEntries(entries) as SolidarityContracts<Name>;
}

async function deployContract(
  contract: SolidarityContract,
  account: string,
  args?: any[]
) {
  // Deploy contract to local Ethereum network
  return new web3.eth.Contract(contract.abi)
    .deploy({ data: contract.bytecode, arguments: args })
    .send({ from: account, gas: 10000000 });
}

// Add subscriptions
web3.eth.subscribe("pendingTransactions", (err, txnHash) => {
  if (err) console.error(err);
  else postMessage({ type: "pendingTransaction", txnHash });
});
web3.eth.subscribe("newBlockHeaders", (err, blockHeader) => {
  if (err) console.error(err);
  else postMessage({ type: "blockHeader", blockHeader });
});
// web3.eth.subscribe("logs", {}, (err, log) => {
//   if (err) console.error(err);
//   // const decoded = web3.eth.abi.decodeLog(
//   //   logContract.options.jsonInterface[0].inputs!,
//   //   log.data,
//   //   log.topics.slice(1)
//   // );
//   else postMessage({ type: "log", log });
// });

import gameContractCode from "./game.sol";
import ticTacToeContractCode from "./tic_tac_toe.sol";
import basicStrategyContractCode from "./basic_strategy.sol";

addEventListener("message", async (event) => {
  const { Tic_tac_toe: game } = await compileContracts<"Tic_tac_toe">(
    ticTacToeContractCode,
    { "game.sol": gameContractCode }
  );
  const { BasicStrategy: strategy } = await compileContracts<"BasicStrategy">(
    basicStrategyContractCode
  );

  const accounts = await web3.eth.getAccounts();
  const player1StrategyContract = await deployContract(strategy, accounts[1]);
  const player2StrategyContract = await deployContract(strategy, accounts[2]);
  const gameContract = await deployContract(game, accounts[0]);

  const txn = await gameContract.methods
    .play([
      player1StrategyContract.options.address,
      player2StrategyContract.options.address,
    ])
    .send({ from: accounts[0], gas: 10000000 });

  const boards: string[][] = txn.events["State_event"].map(
    (event: any) => event.returnValues.board
  );

  postMessage({ type: "result", result: boards });
});
