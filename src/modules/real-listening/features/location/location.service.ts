import { BadRequestException, Injectable } from '@nestjs/common';

import {
  LocationRepository,
  LocationRawItem,
} from '../../infrastructure/repositories/location.repository';
import { LocationFilterDTO } from './dto/location-filter.dto';

@Injectable()
export class LocationService {
  constructor(private readonly locationRepository: LocationRepository) {}

  async query(dto: LocationFilterDTO) {
    try {
      const [currentData, previousData] = await Promise.all([
        this.locationRepository.getLocationData(dto),
        this.locationRepository.getCompareLocationData(dto),
      ]);

      const enriched = enrichWithCoordinates(currentData);
      const top10locations = enriched.map((el) => {
        let percentCompare = 100;
        let previousValue = 0;

        for (const prev of previousData) {
          if (el._id?.toLowerCase() === prev._id?.toLowerCase()) {
            percentCompare =
              prev.count > 0 ? (el.count * 100) / prev.count - 100 : 100;
            previousValue = prev.count;
            break;
          }
        }

        return {
          _id: el._id,
          count: el.count,
          count_previous: previousValue,
          count_percent_compare: parseFloat(percentCompare.toFixed(2)),
          place: el.place,
        };
      });

      const top_locations_previous = enrichWithCoordinates(previousData);

      return { top10locations, top_locations_previous };
    } catch (error: any) {
      throw new BadRequestException([error?.message ?? String(error)]);
    }
  }
}

/* =====================================================================
 * Location helpers (pure, testable)
 * ===================================================================== */

export function enrichWithCoordinates(
  data: LocationRawItem[],
): LocationRawItem[] {
  return data.map((item) => {
    if (!item.place?.ll?.length) {
      const match = matchProvince(item.place?.name ?? item._id ?? '');
      return {
        ...item,
        place: {
          ...item.place,
          ll: match?.ll ?? [],
        },
      };
    }
    return item;
  });
}

interface ProvinceInfo {
  th: string;
  en: string;
  ll: [number, number];
}

export const PROVINCE_LIST: ProvinceInfo[] = [
  { th: 'กระบี่', en: 'Krabi', ll: [8.0862997, 98.90628349999997] },
  { th: 'กรุงเทพมหานคร', en: 'Bangkok', ll: [13.7278956, 100.52412349999997] },
  { th: 'กาญจนบุรี', en: 'Kanchanaburi', ll: [14.0227797, 99.53281149999998] },
  { th: 'กาฬสินธุ์', en: 'Kalasin', ll: [16.4314078, 103.5058755] },
  {
    th: 'กำแพงเพชร',
    en: 'Kamphaeng Phet',
    ll: [16.4827798, 99.52266179999992],
  },
  { th: 'ขอนแก่น', en: 'Khon Kaen', ll: [16.4419355, 102.8359921] },
  { th: 'จันทบุรี', en: 'Chanthaburi', ll: [12.61134, 102.10385459999998] },
  {
    th: 'ฉะเชิงเทรา',
    en: 'Chachoengsao',
    ll: [13.6904194, 101.07795959999999],
  },
  { th: 'ชัยนาท', en: 'Chai Nat', ll: [15.1851971, 100.12512500000003] },
  { th: 'ชัยภูมิ', en: 'Chaiyaphum', ll: [15.8068173, 102.03150270000003] },
  { th: 'ชุมพร', en: 'Chumphon', ll: [10.4930496, 99.18001989999993] },
  { th: 'ชลบุรี', en: 'Chon Buri', ll: [13.3611431, 100.98467170000004] },
  { th: 'เชียงใหม่', en: 'Chiang Mai', ll: [18.7877477, 98.99313110000003] },
  { th: 'เชียงราย', en: 'Chiang Rai', ll: [19.9071656, 99.83095500000002] },
  { th: 'ตรัง', en: 'Trang', ll: [7.5593851, 99.61100650000003] },
  { th: 'ตราด', en: 'Trat', ll: [12.2427563, 102.51747339999997] },
  { th: 'ตาก', en: 'Tak', ll: [16.8839901, 99.12584979999997] },
  { th: 'นครนายก', en: 'Nakhon Nayok', ll: [14.2069466, 101.21305110000003] },
  { th: 'นครปฐม', en: 'Nakhon Pathom', ll: [13.8199206, 100.06216760000007] },
  { th: 'นครพนม', en: 'Nakhon Phanom', ll: [17.392039, 104.76955079999993] },
  {
    th: 'นครราชสีมา',
    en: 'Nakhon Ratchasima',
    ll: [14.9798997, 102.09776929999998],
  },
  {
    th: 'นครศรีธรรมราช',
    en: 'Nakhon Si Thammarat',
    ll: [8.4303975, 99.96312190000003],
  },
  { th: 'นครสวรรค์', en: 'Nakhon Sawan', ll: [15.6930072, 100.12255949999997] },
  { th: 'นนทบุรี', en: 'Nonthaburi', ll: [13.8621125, 100.51435279999998] },
  { th: 'นราธิวาส', en: 'Narathiwat', ll: [6.4254607, 101.82531429999995] },
  { th: 'น่าน', en: 'Nan', ll: [18.7756318, 100.77304170000002] },
  { th: 'บึงกาฬ', en: 'Bueng Kan', ll: [18.3609104, 103.64644629999998] },
  { th: 'บุรีรัมย์', en: 'Buri Ram', ll: [14.9930017, 103.10291910000001] },
  {
    th: 'ประจวบคีรีขันธ์',
    en: 'Prachuap Khiri Khan',
    ll: [11.812367, 99.79732709999996],
  },
  { th: 'ปทุมธานี', en: 'Pathum Thani', ll: [14.0208391, 100.52502759999993] },
  {
    th: 'ปราจีนบุรี',
    en: 'Prachin Buri',
    ll: [14.0509704, 101.37274389999993],
  },
  { th: 'ปัตตานี', en: 'Pattani', ll: [6.869484399999999, 101.25048259999994] },
  {
    th: 'พระนครศรีอยุธยา',
    en: 'Phra Nakhon Si Ayutthaya',
    ll: [14.3532128, 100.56895989999998],
  },
  { th: 'พะเยา', en: 'Phayao', ll: [19.1664789, 99.9019419] },
  { th: 'พังงา', en: 'Phangnga', ll: [8.4407456, 98.51930319999997] },
  { th: 'พัทลุง', en: 'Phatthalung', ll: [7.6166823, 100.07402309999998] },
  { th: 'พิจิตร', en: 'Phichit', ll: [16.4429516, 100.34823289999997] },
  { th: 'พิษณุโลก', en: 'Phitsanulok', ll: [16.8298048, 100.26149150000003] },
  { th: 'เพชรบุรี', en: 'Phetchaburi', ll: [13.1111601, 99.93913069999996] },
  { th: 'เพชรบูรณ์', en: 'Phetchabun', ll: [16.4189807, 101.15509259999999] },
  { th: 'แพร่', en: 'Phrae', ll: [18.1445774, 100.14028310000003] },
  { th: 'ภูเก็ต', en: 'Phuket', ll: [7.9810496, 98.36388239999997] },
  {
    th: 'มหาสารคาม',
    en: 'Maha Sarakham',
    ll: [16.1850896, 103.30264609999995],
  },
  { th: 'มุกดาหาร', en: 'Mukdahan', ll: [16.542443, 104.72091509999996] },
  { th: 'แม่ฮ่องสอน', en: 'Mae Hong Son', ll: [19.2990643, 97.96562259999996] },
  { th: 'ยโสธร', en: 'Yasothon', ll: [15.792641, 104.14528270000005] },
  { th: 'ยะลา', en: 'Yala', ll: [6.541147, 101.28039469999999] },
  { th: 'ร้อยเอ็ด', en: 'Roi Et', ll: [16.0538196, 103.65200359999994] },
  { th: 'ระนอง', en: 'Ranong', ll: [9.9528702, 98.60846409999999] },
  { th: 'ระยอง', en: 'Rayong', ll: [12.6833115, 101.23742949999996] },
  { th: 'ราชบุรี', en: 'Ratchaburi', ll: [13.5282893, 99.81342110000003] },
  { th: 'ลพบุรี', en: 'Lop Buri', ll: [14.7995081, 100.65337060000002] },
  { th: 'ลำปาง', en: 'Lampang', ll: [18.2888404, 99.49087399999996] },
  { th: 'ลำพูน', en: 'Lamphun', ll: [18.5744606, 99.0087221] },
  { th: 'เลย', en: 'Loei', ll: [17.4860232, 101.72230020000006] },
  { th: 'ศรีสะเกษ', en: 'Si Sa Ket', ll: [15.1186009, 104.32200949999992] },
  { th: 'สกลนคร', en: 'Sakon Nakhon', ll: [17.1545995, 104.1348365] },
  { th: 'สงขลา', en: 'Songkhla', ll: [7.1756004, 100.61434699999995] },
  { th: 'สตูล', en: 'Satun', ll: [6.6238158, 100.06737440000006] },
  {
    th: 'สมุทรปราการ',
    en: 'Samut Prakan',
    ll: [13.5990961, 100.59983190000003],
  },
  {
    th: 'สมุทรสงคราม',
    en: 'Samut Songkhram',
    ll: [13.4098217, 100.00226450000002],
  },
  { th: 'สมุทรสาคร', en: 'Samut Sakhon', ll: [13.5475216, 100.27439559999993] },
  { th: 'สระแก้ว', en: 'Sa Kaeo', ll: [13.824038, 102.0645839] },
  { th: 'สระบุรี', en: 'Saraburi', ll: [14.5289154, 100.91014210000003] },
  { th: 'สิงห์บุรี', en: 'Sing Buri', ll: [14.8936253, 100.39673140000002] },
  { th: 'สุโขทัย', en: 'Sukhothai', ll: [17.0055573, 99.82637120000004] },
  { th: 'สุพรรณบุรี', en: 'Suphan Buri', ll: [14.4744892, 100.11771279999994] },
  { th: 'สุราษฎร์ธานี', en: 'Surat Thani', ll: [9.1382389, 99.32174829999997] },
  { th: 'สุรินทร์', en: 'Surin', ll: [14.882905, 103.49371070000007] },
  { th: 'หนองคาย', en: 'Nong Khai', ll: [17.8782803, 102.74126380000007] },
  {
    th: 'หนองบัวลำภู',
    en: 'Nong Bua Lamphu',
    ll: [17.2218247, 102.42603680000002],
  },
  { th: 'อ่างทอง', en: 'Ang Thong', ll: [14.5896054, 100.45505200000002] },
  { th: 'อุดรธานี', en: 'Udon Thani', ll: [17.4138413, 102.78723250000007] },
  { th: 'อุทัยธานี', en: 'Uthai Thani', ll: [15.3835001, 100.02455269999996] },
  { th: 'อุตรดิตถ์', en: 'Uttaradit', ll: [17.6200886, 100.09929420000003] },
  {
    th: 'อุบลราชธานี',
    en: 'Ubon Ratchathani',
    ll: [15.2286861, 104.85642170000006],
  },
  {
    th: 'อำนาจเจริญ',
    en: 'Amnat Charoen',
    ll: [15.8656783, 104.62577740000006],
  },
];

export function matchProvince(name: string): ProvinceInfo | undefined {
  const lower = name.toLowerCase();
  return PROVINCE_LIST.find(
    (p) => p.th.toLowerCase() === lower || p.en.toLowerCase() === lower,
  );
}
