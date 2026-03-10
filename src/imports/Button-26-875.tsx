export default function Button() {
  return (
    <div className="bg-[#f5f6fa] relative rounded-[4px] size-full" data-name="Button">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex gap-[4px] items-center justify-center px-[12px] relative size-full">
          <p className="font-['Barlow',sans-serif] font-semibold leading-[20px] not-italic relative shrink-0 text-[#1a1a1a] text-[14px] whitespace-nowrap">Shop now</p>
        </div>
      </div>
    </div>
  );
}