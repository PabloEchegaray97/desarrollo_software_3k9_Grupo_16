export type ApiErrorDetails = Readonly<Record<string, unknown>> | readonly string[];

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: ApiErrorDetails;
  };
}
