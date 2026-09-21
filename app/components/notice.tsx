export enum ColorVariant {
  Loading = 'loading',
  Error = 'error',
  Success = 'success',
  Info = 'info',
}

interface NoticeProps {
  colorVariant: ColorVariant;
  message: string;
}

const Notice: React.FC<NoticeProps> = ({ colorVariant, message }) => {
  let backgroundColor: string;
  let textColor: string;

  switch (colorVariant) {
    case ColorVariant.Loading:
      backgroundColor = 'bg-blue-100';
      textColor = 'text-blue-600';
      break;
    case ColorVariant.Error:
      backgroundColor = 'bg-red-100';
      textColor = 'text-red-600';
      break;
    case ColorVariant.Success:
      backgroundColor = 'bg-green-100';
      textColor = 'text-green-600';
      break;
    case ColorVariant.Info:
      backgroundColor = 'bg-yellow-100';
      textColor = 'text-yellow-600';
      break;
    default:
      backgroundColor = 'bg-gray-100';
      textColor = 'text-gray-600';
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-stone-400 bg-opacity-10">
      <div
        className={`p-4 ${backgroundColor} ${textColor} text-lg font-medium rounded-md shadow-md`}
      >
        {message}
      </div>
    </div>
  );
};

export default Notice;
