import { gql } from '@apollo/client';

export const GET_MISTAKE_WORDS = gql`
  query GetMistakeWords($userId: String!) {
    mistakeWords(userId: $userId) {
      enUS
      zhTW
      hasAITemplate
    }
  }
`;

export default GET_MISTAKE_WORDS;
