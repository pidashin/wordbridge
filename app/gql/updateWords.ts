import { gql } from '@apollo/client';

export const UPDATE_WORDS_MUTATION = gql`
  mutation UpdateWords($words: [WordInput!]!) {
    updateWords(words: $words) {
      enUS
      zhTW
    }
  }
`;

export default UPDATE_WORDS_MUTATION;
