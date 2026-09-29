import { gql } from '@apollo/client';

export const GET_WORD_PROGRESS = gql`
  query GetWordProgress($userId: String!) {
    wordProgress(userId: $userId) {
      word
      isWrong
      wrongWeight
    }
  }
`;

export default GET_WORD_PROGRESS;
