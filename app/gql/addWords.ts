import { gql } from '@apollo/client';

export const ADD_WORDS_MUTATION = gql`
  mutation AddWords($words: [WordInput!]!) {
    addWords(words: $words) {
      enUS
      zhTW
    }
  }
`;

export default ADD_WORDS_MUTATION;
