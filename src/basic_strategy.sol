// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

enum Player { None, One, Two }

interface Strategy {
    function get_move(Player[] memory) external pure returns (uint);
}

contract BasicStrategy {
    function get_move(Player[] memory board) external pure returns (uint) {
        for (uint i = 0; i < board.length; i++) {
            if (board[i] == Player.None) {
                return i;
            }
        }
        return 0;
    }
}
