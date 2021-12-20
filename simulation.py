from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import pandas as pd
import cryptowat
from dummy_bank import DummyBank
import strategy


# Initialization
start_time = '2021-1-01 12:00 +0900'
end_time = '2021-12-20 12:00 +0900'
ohlc = cryptowat.get_OHLC(end_time, start_time)
resource_jpy = 550000
step_volume = 500
target_value = 0

# Create Bacnk Account
dollcoss_bank = DummyBank(resource_jpy)
value_bank = DummyBank(resource_jpy)
mba_value_bank = DummyBank(resource_jpy)

for i in ohlc.iterrows():
  btc_price = i[1]['close']
  target_value += step_volume

  # ドルコス平均法
  strategy.dollcoss(dollcoss_bank, btc_price, step_volume)

  # バリュー平均法
  strategy.value_average(value_bank, btc_price, target_value, 1)

  # MBA太郎法
  strategy.value_average(mba_value_bank, btc_price, target_value, 1.12)

dollcoss_bank.print_performance()
value_bank.print_performance()
mba_value_bank.print_performance()

# 可視化
df = pd.DataFrame(
    data={
      'close': ohlc['close'],
      'dollcoss': dollcoss_bank.evaluate_history,
      'valued': value_bank.evaluate_history,
      'mba_valued': mba_value_bank.evaluate_history,
    }
)
df.plot(secondary_y=['close'])
plt.show()

