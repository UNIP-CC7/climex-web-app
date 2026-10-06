import styled from 'styled-components'

export const Frame = styled.div`
  position: relative;
  height: calc(100dvh - 150px);
  min-height: 520px;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.line};
  @media (max-width: 900px) {
    height: 70dvh;
  }
`
const floating = `position: absolute; z-index: 800; background: rgba(3,26,60,.92); border: 1px solid rgba(202,230,255,.14); border-radius: 12px;`
export const Layers = styled.div`
  ${floating} top: 14px;
  right: 14px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
  label {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border-radius: 8px;
    cursor: pointer;
  }
  label:hover {
    background: rgba(202, 230, 255, 0.07);
  }
  input {
    accent-color: ${({ theme }) => theme.colors.primaryLighten};
    width: 16px;
    height: 16px;
  }
`
export const Legend = styled.div`
  ${floating} left: 14px;
  bottom: 26px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  i {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    margin-right: 8px;
    vertical-align: -1px;
  }
`
export const Loading = styled.div`
  ${floating} left: 50%;
  top: 14px;
  transform: translateX(-50%);
  padding: 8px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted};
`
