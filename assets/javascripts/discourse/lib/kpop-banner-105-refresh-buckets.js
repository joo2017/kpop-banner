const kstOffsetMs = 9 * 60 * 60 * 1000;

export function kstProxyDate(date = new Date()) {
  return new Date(date.getTime() + kstOffsetMs);
}

export function formatKstBucket(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}+09:00`;
}

export function getIchartBucketKey(date = new Date()) {
  const bucket = kstProxyDate(date);
  const minute = bucket.getUTCMinutes();

  if (minute < 5) {
    bucket.setUTCHours(bucket.getUTCHours() - 1, 35, 0, 0);
  } else if (minute < 35) {
    bucket.setUTCMinutes(5, 0, 0);
  } else {
    bucket.setUTCMinutes(35, 0, 0);
  }

  return `ichart:${formatKstBucket(bucket)}`;
}

export function getCircleMultiBucketKey(date = new Date()) {
  const bucket = kstProxyDate(date);
  const hour = bucket.getUTCHours();
  const minute = bucket.getUTCMinutes();

  if (hour === 0 && minute < 20) {
    bucket.setUTCDate(bucket.getUTCDate() - 1);
  }

  bucket.setUTCHours(0, 20, 0, 0);
  return `circle-multi:${formatKstBucket(bucket)}`;
}

export function getKpoppingBucketKey(date = new Date()) {
  return `kpopping:${formatKstBucket(kstProxyDate(date)).slice(0, 10)}`;
}

export function getSoridataBucketKey(date = new Date()) {
  return `soridata:${formatKstBucket(kstProxyDate(date)).slice(0, 10)}`;
}
