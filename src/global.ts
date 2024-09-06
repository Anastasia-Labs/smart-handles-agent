import {UTxO} from "@anastasia-labs/smart-handles-offchain";

const ROUTED_UTXOS: UTxO[] = [];

export function getRoutedUTxOs() {
  return ROUTED_UTXOS;
}
