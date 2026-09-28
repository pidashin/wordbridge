import { gql } from '@apollo/client';

export const RECORD_ANSWER = gql`
  mutation RecordAnswer(
    $userId: String!
    $word: String!
    $correct: Boolean!
    $isMistakeReview: Boolean!
  ) {
    recordAnswer(
      userId: $userId
      word: $word
      correct: $correct
      isMistakeReview: $isMistakeReview
    ) {
      word
      isWrong
      wrongWeight
    }
  }
`;

export default RECORD_ANSWER;
