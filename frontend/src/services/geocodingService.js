import { request } from './stationsApi';

// Public Nominatim accepts explicit searches, not autocomplete as the user types.
export async function searchAddresses(query, signal) {
  try {
    const data = await request(
      `/journey-planner/geocoding?${new URLSearchParams({ search: query.trim() })}`,
      { signal },
    );
    return data.items;
  } catch (error) {
    if (error.status >= 500)
      throw new Error(
        'Chưa tìm được địa chỉ. Bạn có thể chọn trạm xe hoặc thử lại sau.',
        { cause: error },
      );
    throw error;
  }
}
